import * as Mp4Muxer from "mp4-muxer";
let muxer = new Mp4Muxer.Muxer({
  target: new Mp4Muxer.ArrayBufferTarget(),
  video: { codec: 'avc', width: 1920, height: 1080 },
  fastStart: 'in-memory'
});
console.log("Muxer initialized");
