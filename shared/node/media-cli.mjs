import { execFileSync } from 'node:child_process';

// Media validation must never wait for terminal input or run without a bound.
export function runMedia(command, args, options = {}) {
  const safeArgs=command==='ffmpeg' ? ['-nostdin','-threads','1','-filter_threads','1','-filter_complex_threads','1',...args] : args;
  try { return execFileSync(command,safeArgs,{encoding:'utf8',maxBuffer:32*1024*1024,timeout:45_000,...options}); }
  catch(error){
    if(error.code==='ENOENT')throw new Error(`${command} is required for media preparation/validation. Install FFmpeg, which includes ffprobe.`,{cause:error});
    if(error.code==='ETIMEDOUT')throw new Error(`${command} exceeded the 45-second media processing limit. Input: ${args[args.indexOf('-i')+1] || args.at(-1)}`,{cause:error});
    throw error;
  }
}
