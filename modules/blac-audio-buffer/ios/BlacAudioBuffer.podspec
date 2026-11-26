Pod::Spec.new do |s|
  s.name           = 'BlacAudioBuffer'
  s.version        = '1.0.0'
  s.summary        = 'How much of the playing song has loaded.'
  s.description    = 'Reads the loaded time ranges of the player that expo-audio plays a queue with.'
  s.license        = 'UNLICENSED'
  s.author         = 'Blac'
  s.homepage       = 'https://blacmusic.pkasemer.com'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
