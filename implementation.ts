import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';

dotenv.config(); // Load from .env

const API_URL = 'https://api.assemblyai.com/v2/transcript';
const UPLOAD_URL = 'https://api.assemblyai.com/v2/upload';
const API_TOKEN = process.env.ASSEMBLYAI_API_KEY;

if (!API_TOKEN) {
  console.error('Missing ASSEMBLYAI_API_KEY in .env file');
  process.exit(1);
}

async function uploadAudio(filePath: string): Promise<string> {
  const fileStream = fs.createReadStream(filePath);
  const response = await axios({
    method: 'post',
    url: UPLOAD_URL,
    headers: {
      authorization: API_TOKEN,
      'transfer-encoding': 'chunked',
    },
    data: fileStream,
  });

  return response.data.upload_url;
}

async function requestTranscription(audioUrl: string): Promise<string> {
  const response = await axios.post(
    API_URL,
    {
      audio_url: audioUrl,
      speaker_labels: true,
    },
    {
      headers: {
        authorization: API_TOKEN,
        'content-type': 'application/json',
      },
    }
  );

  return response.data.id;
}

async function waitForCompletion(transcriptId: string): Promise<any> {
  const pollingEndpoint = `${API_URL}/${transcriptId}`;
  while (true) {
    const response = await axios.get(pollingEndpoint, {
      headers: { authorization: API_TOKEN },
    });

    const status = response.data.status;
    if (status === 'completed') return response.data;
    else if (status === 'error') throw new Error(response.data.error);
    await new Promise((res) => setTimeout(res, 3000));
  }
}

function formatTranscript(utterances: any[]): string {
  return utterances
    .map((utt) => {
      const speaker = utt.speaker === 'A' ? 'AGENT' : 'CALLER';
      return `${speaker}: ${utt.text}`;
    })
    .join('\n');
}

async function main() {
  const audioPath = process.argv[2];
  if (!audioPath) {
    console.error("Please provide the path to the audio file as an argument.");
  process.exit(1);
  }

  console.log('File Path:', audioPath);

  try {
    console.log('Uploading audio...');
    const audioUrl = await uploadAudio(audioPath);

    console.log('Requesting transcription...');
    const transcriptId = await requestTranscription(audioUrl);

    console.log('Waiting for transcription to complete...');
    const result = await waitForCompletion(transcriptId);

    console.log('Formatting transcript...');
    const formatted = formatTranscript(result.utterances);
    console.log('\n--- Transcript ---\n');
    console.log(formatted);
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
