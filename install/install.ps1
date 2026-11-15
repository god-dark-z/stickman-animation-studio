# Stickman Animation Studio installer (Windows PowerShell).
# See install.sh for the full usage; same behavior.
#
#   .\install.ps1 [-WithEngine] [-Dir C:\path\to\project]
param(
  [switch]$WithEngine,
  [string]$Dir = (Get-Location).Path
)
$ErrorActionPreference = "Stop"
$Src = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

$SkillDir = Join-Path $Dir ".claude\skills\stickman-animation-studio"
New-Item -ItemType Directory -Force -Path $SkillDir, (Join-Path $Dir ".claude\commands") | Out-Null
Copy-Item (Join-Path $Src "SKILL.md") $SkillDir -Force
Copy-Item (Join-Path $Src "references") $SkillDir -Recurse -Force
Copy-Item (Join-Path $Src "commands\make-video.md") (Join-Path $Dir ".claude\commands\make-video.md") -Force
Write-Host "OK skill   -> $SkillDir"
Write-Host "OK command -> $Dir\.claude\commands\make-video.md"

# per-agent command adapters (same body, each agent's native slot)
foreach ($slot in @(".opencode\command", ".cursor\commands")) {
  $d = Join-Path $Dir $slot
  New-Item -ItemType Directory -Force -Path $d | Out-Null
  Copy-Item (Join-Path $Src "commands\make-video.md") (Join-Path $d "make-video.md") -Force
  Write-Host "OK command -> $d\make-video.md"
}
$ghp = Join-Path $Dir ".github\prompts"
New-Item -ItemType Directory -Force -Path $ghp | Out-Null
Copy-Item (Join-Path $Src "commands\make-video.md") (Join-Path $ghp "make-video.prompt.md") -Force
Write-Host "OK prompt  -> $ghp\make-video.prompt.md"

$gem = Join-Path $Dir ".gemini\commands"
New-Item -ItemType Directory -Force -Path $gem | Out-Null
& bash "$Src\install\make-gemini-toml.sh" "$Src\commands\make-video.md" (Join-Path $gem "make-video.toml") 2>$null
if (-not (Test-Path (Join-Path $gem "make-video.toml"))) {
  # no bash available: write a minimal TOML that points at the canonical skill file
  @"
description = "Produce a complete professional English stickman cartoon video (Stickman Animation Studio)"
prompt = """
Execute the Stickman Animation Studio pipeline: read .claude/skills/stickman-animation-studio/SKILL.md and follow it exactly to produce a verified 1080x1920 MP4 from this input: {{args}}
"""
"@ | Set-Content (Join-Path $gem "make-video.toml") -Encoding UTF8
}
Write-Host "OK command -> $gem\make-video.toml"

if ($WithEngine) {
  $EngineDir = Join-Path $Dir "engine"
  New-Item -ItemType Directory -Force -Path $EngineDir | Out-Null
  Get-ChildItem $Src\engine -Exclude node_modules, out | Copy-Item -Destination $EngineDir -Recurse -Force
  Write-Host "OK engine  -> $EngineDir  (run: cd engine; npm install; pip install edge-tts imageio-ffmpeg numpy scipy)"
}

$Marker = "<!-- stickman-animation-studio:v1 -->"
$Pointer = @"
$Marker

## /make-video — Stickman Animation Studio

When the user asks to make/create/generate a video, short, cartoon or animated explainer (or
types ``/make-video <topic>``): read ``.claude/skills/stickman-animation-studio/SKILL.md`` and
follow it exactly. It researches and fact-checks the topic, writes a 190-210 word script,
storyboards it as JSON, renders it with the bundled programmatic stickman engine, QA-gates every
shot, and delivers a verified 1080x1920 MP4. No AI image/video generation, no paid APIs.
Reference material lives beside SKILL.md in ``references/``.
"@

function Write-Pointer($file) {
  $dir = Split-Path -Parent $file
  if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $body = ""
  if (Test-Path $file) {
    $body = (Get-Content $file -Raw)
    if ($body -match [regex]::Escape($Marker)) {
      $body = ($body -split [regex]::Escape($Marker))[0]
    }
  }
  Set-Content -Path $file -Value ($body.TrimEnd() + "`n`n" + $Pointer + "`n") -Encoding UTF8
  Write-Host "OK pointer -> $file"
}

Write-Pointer (Join-Path $Dir "AGENTS.md")
Write-Pointer (Join-Path $Dir "GEMINI.md")
Write-Pointer (Join-Path $Dir ".github\copilot-instructions.md")
Write-Pointer (Join-Path $Dir ".cursor\rules\stickman-animation-studio.mdc")
Write-Pointer (Join-Path $Dir ".windsurf\rules\stickman-animation-studio.md")
Write-Pointer (Join-Path $Dir "CONVENTIONS.md")

Write-Host ""
Write-Host "Done. Claude Code / ZCode: type  /make-video <topic>"
Write-Host "First render in a new project: cd engine; npm install; pip install edge-tts imageio-ffmpeg numpy scipy"
