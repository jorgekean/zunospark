Add-Type -AssemblyName System.Speech

$voiceDir = "public\audio\voiceover"
if (-not (Test-Path $voiceDir)) {
    New-Item -ItemType Directory -Path $voiceDir -Force | Out-Null
}

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer

# List available voices
Write-Host "Available voices:"
$voices = $synth.GetInstalledVoices()
foreach ($v in $voices) {
    Write-Host "- $($v.VoiceInfo.Name) ($($v.VoiceInfo.Gender), $($v.VoiceInfo.Culture))"
}

# Try to select a female or friendly English voice (like Microsoft Zira or David)
$preferredVoice = $voices | Where-Object { $_.VoiceInfo.Name -like "*Zira*" -or $_.VoiceInfo.Name -like "*Eva*" -or $_.VoiceInfo.Gender -eq "Female" } | Select-Object -First 1
if ($preferredVoice) {
    $synth.SelectVoice($preferredVoice.VoiceInfo.Name)
    Write-Host "Selected voice: $($preferredVoice.VoiceInfo.Name)"
} else {
    Write-Host "Using default voice: $($synth.Voice.Name)"
}

$synth.Rate = 0  # Normal speed, clear articulation
$synth.Volume = 100

$lines = @(
    @{
        File = "$voiceDir\scene1_screentrap.wav"
        Text = "Ever notice why standard screen time always triggers a meltdown the second you say 'all done'? Rapid flashing videos hijack young attention spans, leading straight to dopamine crashes."
    },
    @{
        File = "$voiceDir\scene2_intro.wav"
        Text = "Meet ZunoSpark. A calm, low-stimulation executive function gym designed by pediatric occupational therapy principles."
    },
    @{
        File = "$voiceDir\scene3_waitpower.wav"
        Text = "In Spot One, Wait-Power, kids build impulse control. They practice waiting patiently while Zuno sleeps, and tap only when his spark glows golden. No penalties. No flashing lights."
    },
    @{
        File = "$voiceDir\scene4_chimes.wav"
        Text = "In Thunder Chimes, gentle marimba notes train auditory working memory and two-part instruction following."
    },
    @{
        File = "$voiceDir\scene5_transition.wav"
        Text = "And when micro-sessions end, there are zero lockout tears. Zuno's tail charges up, naturally inspiring your child to take their spark outside into the real world."
    },
    @{
        File = "$voiceDir\scene6_roi_cta.wav"
        Text = "Real waiting patience. Zero tantrums. Try ZunoSpark free on web, iOS, and Android today."
    }
)

foreach ($item in $lines) {
    Write-Host "Synthesizing: $($item.File)..."
    $synth.SetOutputToWaveFile($item.File)
    $synth.Speak($item.Text)
}

$synth.SetOutputToNull()
Write-Host "All voiceovers generated successfully in $voiceDir!"
