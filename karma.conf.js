module.exports = function(config) {
  config.set({
    client: {captureConsole: false},
    frameworks: ['browserify', 'mocha', 'chai'],
    browsers: ['PhantomJS'],
    preprocessors:
        {'app/**/*.js': ['browserify'], 'test/**/*.js': ['browserify']},
    files: [
      'node_modules/babel-polyfill/dist/polyfill.js',
      'app/scripts/**/*.js',
      'test/**/*.js'
    ],
    reporters: ['dots'],
    browserify: {debug: true, transform: ["babelify"]}
  });
};