// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

using System.Diagnostics;
using System.Diagnostics.CodeAnalysis;
using System.Text;
using System.Text.Json;
using System.Xml.Linq;
using LibGit2Sharp;
using NuGet.Versioning;

if (args.Length < 1)
{
    Console.Error.WriteLine("No Git repository path specified.");
    return 1;
}

using var repo = new Repository(args[0]);
var interactive = string.Equals(args.LastOrDefault(), "--interactive", StringComparison.OrdinalIgnoreCase);

var author = repo.Head.Commits.First().Author;
var identity = new Identity(author.Name, author.Email);

var defaultBranch = args.Skip(1).Where((p) => !p.StartsWith("--", StringComparison.Ordinal)).FirstOrDefault() ?? "main";

var branch = repo.Head;
var target = repo.Branches[defaultBranch] ?? repo.Branches[$"origin/{defaultBranch}"];

var options = new RebaseOptions();
var result = repo.Rebase.Start(branch, target, null, identity, new());

while (result.Status is not RebaseStatus.Complete)
{
    // Resolve in reverse so package-lock.json is fixed after package.json
    foreach (var conflict in repo.Index.Conflicts.Reverse())
    {
        var fileName = Path.GetFullPath(Path.Combine(repo.Info.Path, "..", conflict.Ours.Path));
        var resolvedConflict = Path.GetFileName(fileName) switch
        {
            "package-lock.json" => await TryResolveNpmLockFileConflictsAsync(fileName),
            _ => await TryResolvePackageConflictsAsync(fileName, conflict),
        };

        if (!resolvedConflict)
        {
            if (interactive)
            {
                var startInfo = new ProcessStartInfo("code")
                {
                    ArgumentList = { fileName, "--wait" },
                    UseShellExecute = true,
                };

                using var process = Process.Start(startInfo)!;
                await process.WaitForExitAsync();

                if (process.ExitCode != 0)
                {
                    Console.Error.WriteLine($"Unable to resolve merge conflict in {conflict.Ours.Path} with Visual Studio Code.");
                    return 1;
                }

                resolvedConflict = true;
            }
            else
            {
                Console.Error.WriteLine($"Unable to resolve merge conflict in {conflict.Ours.Path}.");
                return 1;
            }
        }

        repo.Index.Add(conflict.Ours.Path);
    }

    result = repo.Rebase.Continue(identity, options);
}

return 0;

static async Task<bool> TryResolveNpmLockFileConflictsAsync(string fileName)
{
    File.Delete(fileName);

    var projectPath = Path.GetDirectoryName(fileName)!;

    var startInfo = new ProcessStartInfo("npm", "install")
    {
        UseShellExecute = true,
        WorkingDirectory = projectPath,
    };

    using var process = Process.Start(startInfo)!;
    await process.WaitForExitAsync();

    return process.ExitCode == 0;
}

static bool TryParsePackageVersion(string value, [NotNullWhen(true)] out NuGetVersion? version)
{
    if (TryParseXml(value, out var fragment) && IsPackageElement(fragment))
    {
        var versionString = fragment.Attribute("Version")?.Value;

        if (NuGetVersion.TryParse(versionString, out version))
        {
            return true;
        }
    }
    else if (TryParseJson(value, out var document))
    {
        try
        {
            foreach (var property in document.RootElement.EnumerateObject())
            {
                var versionString = property.Value.GetString();

                if (versionString?.Length > 0 && versionString[0] == '^')
                {
                    versionString = versionString[1..];
                }

                if (NuGetVersion.TryParse(versionString, out version))
                {
                    return true;
                }
            }
        }
        finally
        {
            document.Dispose();
        }
    }

    version = null;
    return false;

    static bool TryParseJson(string value, [NotNullWhen(true)] out JsonDocument? document)
    {
        if (value.StartsWith('<'))
        {
            document = null;
            return false;
        }

        var jsonUtf8Bytes = Encoding.UTF8.GetBytes('{' + value + '}');
        var options = new JsonReaderOptions() { AllowTrailingCommas = true };

        var reader = new Utf8JsonReader(jsonUtf8Bytes, options);

        try
        {
            return JsonDocument.TryParseValue(ref reader, out document);
        }
        catch (JsonException)
        {
            document = null;
            return false;
        }
    }

    static bool TryParseXml(string value, [NotNullWhen(true)] out XElement? fragment)
    {
        try
        {
            fragment = XDocument.Parse(value).Root;
            return fragment is not null;
        }
        catch (Exception)
        {
            fragment = null;
            return false;
        }
    }

    static bool IsPackageElement(XElement element)
        => element.Name == "PackageReference" || element.Name == "PackageVersion";
}

static async Task<bool> TryResolvePackageConflictsAsync(string fileName, Conflict conflict)
{
    const string TheirsMarker = "<<<<<<<";
    const string MidpointMarker = "=======";
    const string OursMarker = ">>>>>>>";

    var lines = await File.ReadAllLinesAsync(fileName);

    int conflicts = lines.Count((p) => p.StartsWith(TheirsMarker));

    var merged = new List<string>(lines.Length);
    int line = 0;

    for (int i = 0; i < conflicts; i++)
    {
        int theirIndex = Array.FindIndex(lines, line, (p) => p.StartsWith(TheirsMarker));
        int midpoint = Array.FindIndex(lines, line, (p) => p.StartsWith(MidpointMarker));
        int ourIndex = Array.FindIndex(lines, line, (p) => p.StartsWith(OursMarker));

        merged.AddRange(lines[line..theirIndex]);

        var theirs = lines[(theirIndex + 1)..midpoint];
        var ours = lines[(midpoint + 1)..ourIndex];

        bool resolvedConflict = false;

        if (theirs.Length == ours.Length)
        {
            for (int j = 0; j < theirs.Length; j++)
            {
                var theirLine = theirs[j];
                var ourLine = ours[j];

                if (TryParsePackageVersion(theirLine, out var theirVersion) &&
                    TryParsePackageVersion(ourLine, out var ourVersion))
                {
                    // Take the package version with the highest version number
                    if (theirVersion.CompareTo(ourVersion) > 0)
                    {
                        merged.Add(theirLine);
                    }
                    else
                    {
                        merged.Add(ourLine);
                    }

                    resolvedConflict = true;
                }
            }
        }

        if (!resolvedConflict)
        {
            return false;
        }

        line = ourIndex + 1;
    }

    merged.AddRange(lines[line..]);

    await File.WriteAllLinesAsync(fileName, merged);
    return true;
}
