import AVFoundation
import ExpoModulesCore

/// expo-audio does not say how much of a song has loaded, so this reads it from the same player. A queue in
/// expo-audio is a `SharedRef<AVQueuePlayer>`, which Expo lets another module receive as it is.
public class BlacAudioBufferModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BlacAudioBuffer")

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
