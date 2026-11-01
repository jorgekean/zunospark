const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const fs = require('fs');
const path = require('path');

const voiceDir = path.join(__dirname, '..', 'public', 'audio', 'voiceover');
if (!fs.existsSync(voiceDir)) {
  fs.mkdirSync(voiceDir, { recursive: true });
}

// en-US-JennyNeural is a warm, natural, compassionate American female voice perfect for parenting & education
const VOICE_NAME = 'en-US-JennyNeural';

const scenes = [
  {
    name: 'scene1_screentrap',
    text: "Ever notice how ordinary screen time always ends in meltdowns? Rapid flashing videos flood young brains with dopamine, leaving them in sensory overload the second you say 'all done'."
  },
  {
    name: 'scene2_intro',
    text: "That's why we created ZunoSpark. A calm, low-stimulation executive function gym built with pediatric occupational therapy principles. Zero ads, zero dopamine traps."
  },
  {
    name: 'scene3_waitpower',
    text: "In Spot One, Wait-Power, children learn impulse control. They watch Zuno sleep, practicing the superpower of waiting, and tap only when his spark turns gold. Fewer grocery store meltdowns, more real-world patience."
  },
  {
    name: 'scene4_chimes',
    text: "In Thunder Chimes, children listen to gentle marimba melodies and repeat the pattern. Strengthening auditory working memory, so you don't have to repeat directions five times."
  },
  {
    name: 'scene5_transition',
    text: "And when the session finishes, there are zero lockout meltdowns. Zuno's tail is fully charged, and he gently inspires your child to transition off the screen and play outside."
  },
  {
    name: 'scene6_roi_cta',
    text: "Real behavioral milestones for you. Calm, focused growth for them. Try ZunoSpark free on web and Google Play today."
  }
];

async function generateAll() {
  console.log(`Initializing MsEdgeTTS with voice: ${VOICE_NAME}...`);
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE_NAME, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

  for (const scene of scenes) {
    const tempDir = path.join(voiceDir, `temp_${scene.name}`);
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });

    console.log(`Generating: ${scene.name}...`);
    await tts.toFile(tempDir, scene.text);

    const generatedMp3 = path.join(tempDir, 'audio.mp3');
    const targetMp3 = path.join(voiceDir, `${scene.name}.mp3`);
    if (fs.existsSync(generatedMp3)) {
      fs.copyFileSync(generatedMp3, targetMp3);
      console.log(`✓ Saved ${scene.name}.mp3 (${fs.statSync(targetMp3).size} bytes)`);
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log("All 6 neural human voiceovers successfully generated!");
}

generateAll().catch(err => {
  console.error("Error generating voiceovers:", err);
  process.exit(1);
});
