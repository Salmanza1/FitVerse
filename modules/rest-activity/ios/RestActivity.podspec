Pod::Spec.new do |s|
  s.name           = 'RestActivity'
  s.version        = '1.0.0'
  s.summary        = 'Starts and ends the rest-timer Live Activity.'
  s.description    = 'Bridges ActivityKit to JS so the rest timer can run in the Dynamic Island.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
