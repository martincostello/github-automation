// Copyright (c) Martin Costello, 2023. All rights reserved.

using System.Diagnostics;
using System.Diagnostics.CodeAnalysis;
using System.Xml.Linq;
using LibGit2Sharp;
using NuGet.Versioning;

using var repo = new Repository(args[0]);

var author = repo.Head.Commits.First().Author;
var identity = new Identity(author.Name, author.Email);

var branch = repo.Head;
var target = repo.Branches["main"] ?? repo.Branches["origin/main"];

var options = new RebaseOptions();
Branch? onto = null;

var result = repo.Rebase.Start(branch, target, onto, identity, options);

var repoPath = Path.Combine(repo.Info.Path, "..");

while (result.Status is not RebaseStatus.Complete)
{
    foreach (var conflict in repo.Index.Conflicts)
    {
        var filePath = Path.GetFullPath(Path.Combine(repoPath, conflict.Ours.Path));
        var fileName = Path.GetFileName(filePath);

        bool resolvedConflict = fileName switch
        {
            "global.json" => false, // TODO Handle conflicts in global.json
            "package.json" => false, // TODO Handle conflicts in package.json
            "package-lock.json" => await TryResolveNpmLockFileConflictsAsync(filePath),
            _ => await TryResolveNuGetPackageConflictsAsync(filePath, conflict),
        };

        if (resolvedConflict)
        {
            repo.Index.Add(conflict.Ours.Path);
        }
        else
        {
            Console.Error.WriteLine($"Unable to resolve merge conflict in {conflict.Ours.Path}.");
            return 1;
        }
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

static bool TryParseNuGetPackageVersion(string value, [NotNullWhen(true)] out NuGetVersion? version)
{
    if (TryParseXml(value, out var fragment) && IsPackageElement(fragment))
    {
        var versionString = fragment.Attribute("Version")?.Value;

        if (NuGetVersion.TryParse(versionString, out var packageVersion))
        {
            version = packageVersion;
            return true;
        }
    }

    version = null;
    return false;

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

static async Task<bool> TryResolveNuGetPackageConflictsAsync(string fileName, Conflict conflict)
{
    const string TheirsMarker = "<<<<<<<";
    const string MidpointMarker = "=======";
    const string OursMarker = ">>>>>>>";

    var lines = await File.ReadAllLinesAsync(fileName);

    int conflicts = lines.Count((p) => p.StartsWith(TheirsMarker));

    var merged = new List<string>();
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

                if (TryParseNuGetPackageVersion(theirLine, out var theirPackageVersion) &&
                    TryParseNuGetPackageVersion(ourLine, out var ourPackageVersion))
                {
                    // Take the package version with the highest version number
                    if (theirPackageVersion.CompareTo(ourPackageVersion) > 0)
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
