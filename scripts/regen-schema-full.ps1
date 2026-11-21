# Auto-generated helper to regenerate docs/SCHEMA_FULL.md from prisma/schema.prisma
# Usage: powershell -File scripts/regen-schema-full.ps1

$ErrorActionPreference = "Stop"
$enc = New-Object System.Text.UTF8Encoding($false)
$schema = [IO.File]::ReadAllText((Resolve-Path "prisma/schema.prisma"))
$ms = [regex]::Matches($schema, "(?ms)^(model|enum)\s+(\w+)\s+\{([^}]*)\}")
$models = @(); $enums = @()
foreach($m in $ms){ if($m.Groups[1].Value -eq "model"){ $models += $m } else { $enums += $m } }
$out = New-Object System.Collections.Generic.List[string]
$out.Add("# SCHEMA_FULL — Prisma Schema Reference")
$out.Add("")
$out.Add("**Auto-generated from prisma/schema.prisma — DO NOT EDIT MANUALLY**")
$out.Add("")
$out.Add("**Generated:** " + (Get-Date -Format "yyyy-MM-dd HH:mm"))
$out.Add("")
$out.Add("**Stats:** " + $models.Count + " models + " + $enums.Count + " enums")
$out.Add("")
$out.Add("---")
$out.Add("")
$out.Add("## Models (" + $models.Count + ")")
$out.Add("")
foreach($m in $models){ $out.Add("### ``" + $m.Groups[2].Value + "``"); $out.Add(""); $out.Add("```prisma"); $out.Add("model " + $m.Groups[2].Value + " {" + $m.Groups[3].Value + "}"); $out.Add("```"); $out.Add("") }
$out.Add("---")
$out.Add("")
$out.Add("## Enums (" + $enums.Count + ")")
$out.Add("")
foreach($e in $enums){ $out.Add("### ``" + $e.Groups[2].Value + "``"); $out.Add(""); $out.Add("```prisma"); $out.Add("enum " + $e.Groups[2].Value + " {" + $e.Groups[3].Value + "}"); $out.Add("```"); $out.Add("") }
$content = ($out -join "`r`n")
[IO.File]::WriteAllText((Resolve-Path "docs/SCHEMA_FULL.md"), $content, $enc)
Write-Host "REGENERATED: " + ((Get-Item "docs/SCHEMA_FULL.md").Length) + " bytes"