Pod::Spec.new do |s|
  s.name           = 'FocusActivity'
  s.version        = '1.0.0'
  s.summary        = 'Starts, updates and ends the focus timer Live Activity.'
  s.author         = ''
  s.homepage       = 'https://github.com/BaamAhmed/system2.0'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
