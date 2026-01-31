"use client";

import VideoPlayer from "@/components/player/VideoPlayer";

export default function VideoPlayerClient(props: Parameters<typeof VideoPlayer>[0]) {
  return <VideoPlayer {...props} />;
}
