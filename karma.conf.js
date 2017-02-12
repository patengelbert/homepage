module.exports = function(config) {
  config.set({
    client: {captureConsole: false},
    frameworks: ['mocha', 'chai'],
    browsers: ['PhantomJS'],
    files: ['app/scripts/**/*.js', 'test/**/*.js'],
    reporters: ['dots']
  });
};