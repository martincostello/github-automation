$ErrorActionPreference = "Stop"

$workflowsPath = (Join-Path . ".github" "workflows")

$workflows = @()
$workflows += Get-ChildItem -Path . -Filter action.yml -Recurse
$workflows += Get-ChildItem -Path . -Filter action.yaml -Recurse
$workflows += Get-ChildItem -Path $workflowsPath -Filter *.yml
$workflows += Get-ChildItem -Path $workflowsPath -Filter *.yaml

foreach ($file in $workflows) {
    $path = $file.FullName
    $content = Get-Content -Path $file.FullName -Raw

    $fileName = $path.Substring($PWD.Path.Length + 1).Replace('\', '/')
    $workflow = ConvertFrom-Yaml -Yaml $content

    Write-Output "Linting ${fileName}..."

    $errors = 0
    $warnings = 0

    foreach ($job in $workflow.jobs) {
        foreach ($step in $job.Values.steps) {
            if ($step.run -And $step.shell -eq 'pwsh') {
                $script = $step.run

                $firstLine = $script.Split("`n")[0]
                $offset = (Select-String $path -Pattern ([regex]::Escape($firstLine))).LineNumber

                $issues = Invoke-ScriptAnalyzer -ScriptDefinition $script -IncludeDefaultRules -Severity @('Error', 'Warning')

                $errors += $issues.Where({ $_.Severity -eq 'Error' -or $_.Severity -eq 'ParseError' }).Count
                $warnings += $issues.Count - $errors

                foreach ($issue in $issues) {
                    $level = $issue.Severity -eq "Warning" ? "warning" : "error"
                    $line = $offset + $issue.Line - 1
                    Write-Output "::${level} file=${fileName},line=${line},title=PSScriptAnalyzer::${issue}"
                }
            }
        }
    }
}
