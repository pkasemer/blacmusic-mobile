import AVFoundation
import ExpoModulesCore

/// Two things expo-audio's queue does not offer, done on the same player: how much of a song has loaded, and how it
/// uses AirPlay. A queue in expo-audio is a `SharedRef<AVQueuePlayer>`, which Expo lets another module receive as it is.
public class BlacAudioBufferModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BlacAudioBuffer")

    // iPhone's default hands a TV the song's link to fetch and play by itself, and the TV can sit loading. With that
    // off, the iPhone keeps playing and sends the sound, to a TV as to a speaker. (expo-audio offers this switch for
    // its single player, `allowsExternalPlayback`, but not for its queue.)
    Function("keepPlaybackOnPhone") { (player: SharedRef<AVQueuePlayer>) in
      player.ref.allowsExternalPlayback = false
    }

    // The point, in seconds, that the playing song has loaded up to without a gap from where it is now. 0 if unknown.
    Function("loadedUpTo") { (player: SharedRef<AVQueuePlayer>) -> Double in
      guard let item = player.ref.currentItem else {
        return 0
      }
      let now = item.currentTime().seconds
      var upTo = 0.0
      for value in item.loadedTimeRanges {
        let range = value.timeRangeValue
        let start = range.start.seconds
        let end = CMTimeRangeGetEnd(range).seconds
        if start.isFinite && end.isFinite && start <= now + 1 && end >= now {
          upTo = max(upTo, end)
        }
      }
      return upTo
    }
  }
}
