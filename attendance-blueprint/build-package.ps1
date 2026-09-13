$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$packageRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$packageDestination = Join-Path (Split-Path -Parent $packageRoot) 'attendance-firebase-plan.zip'
$packageFiles = @(
  'BLUEPRINT.md', 'GEMINI_PROMPT.md', 'DEPLOYMENT.md', 'DELIVERY_NOTES.md',
  'payroll-core.cjs', 'verify.cjs', 'preview.html', 'mockup.fragment.html',
  'build-preview.cjs', 'build-package.ps1',
  'reference-config/.env.example', 'reference-config/firebase.json',
  'reference-config/firestore.rules', 'reference-config/storage.rules',
  'reference-config/firestore.indexes.json'
)
foreach ($packageName in $packageFiles) {
  if (-not (Test-Path -LiteralPath (Join-Path $packageRoot $packageName) -PathType Leaf)) {
    throw "Package input missing: $packageName"
  }
}
$packageStream = [IO.File]::Open($packageDestination, [IO.FileMode]::Create)
try {
  $packageArchive = [IO.Compression.ZipArchive]::new($packageStream, [IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($packageName in $packageFiles) {
      $packageEntry = 'attendance-firebase-plan/' + $packageName
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($packageArchive, (Join-Path $packageRoot $packageName), $packageEntry) | Out-Null
    }
  } finally { $packageArchive.Dispose() }
} finally { $packageStream.Dispose() }
$packageCheck = [IO.Compression.ZipFile]::OpenRead($packageDestination)
try {
  if ($packageCheck.Entries.Count -ne $packageFiles.Count) { throw 'Package entry count mismatch' }
  Write-Output "Created attendance-firebase-plan.zip with $($packageCheck.Entries.Count) current-plan files."
} finally { $packageCheck.Dispose() }
