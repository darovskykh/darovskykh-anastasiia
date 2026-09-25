declare module 'lamejs' {
  export type Mp3EncoderInstance = {
    encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array;
    flush(): Int8Array;
  };

  export type Mp3EncoderConstructor = new (
    channels: number,
    sampleRate: number,
    kbps: number
  ) => Mp3EncoderInstance;

  const lamejs: {
    Mp3Encoder: Mp3EncoderConstructor;
  };

  export default lamejs;
}
