const gulp = require('gulp');
const path = require('path');
const util = require("gulp-util");
const gulpLoadPlugins = require('gulp-load-plugins');
const browserSync = require('browser-sync').create();
const del = require('del');
const wiredep = require('wiredep').stream;
const runSequence = require('run-sequence');
const browserify = require("browserify");
const babelify = require('babelify');
const rollupify = require('rollupify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const merge = require('merge');

const $ = gulpLoadPlugins();
const reload = browserSync.reload;

const srcDir = 'app';
const testDir = 'test';
const devDir = '.tmp';
const prodDir = 'dist';

const dev = !util.env.production;

if (dev) {
  var karma = require('karma');
  var backstop = require('backstopjs');
}

var getBundleName = function (min = false) {
  var version = require('./package.json').version;
  var name = require('./package.json').name;
  return version + '.' + name + (min ? '.min' : '');
};

gulp.task('styles', ['lint:styles'], () => {
  return gulp.src(path.join(srcDir, 'styles', '*.{css,scss}'))
    .pipe($.plumber())
    .pipe($.if(/\.scss$/, $.sass().on('error', $.sass.logError)))
    .pipe($.if(dev, $.sourcemaps.init()))
    .pipe($.autoprefixer({ browsers: ['> 1%', 'last 2 versions', 'Firefox ESR'] }))
    .pipe($.if(!dev, $.cssnano({ safe: true, autoprefixer: false })))
    .pipe($.if(dev, $.sourcemaps.write()))
    .pipe($.rename(getBundleName(!dev) + '.css'))
    .pipe(gulp.dest(path.join((dev ? devDir : prodDir), 'styles')))
    .pipe(reload({stream: true}));
});

gulp.task('scripts', ['lint:scripts'], () => {
  return browserify({ entries: path.join(srcDir, 'scripts', 'app.js'), debug: dev })
    .transform(rollupify, babelify)
    .bundle()
    .on('error', function (err) {
        console.log(err.toString());
        this.emit("end");
    })
    .pipe(source(getBundleName(!dev) + '.js'))
    .pipe($.plumber())
    .pipe(buffer())
    .pipe($.if(dev, $.sourcemaps.init({ loadMaps: true })))
    .pipe($.if(!dev, $.uglify({ compress: { drop_console: true } })))
    .pipe($.concat(getBundleName(!dev) + '.js'))
    .pipe($.if(dev, $.sourcemaps.write('.')))
    .pipe(gulp.dest(path.join((dev ? devDir : prodDir), 'scripts')))
    .pipe(reload({ stream: true }));
});

function lint(files, param = {}) {
  return gulp.src(files)
    .pipe($.eslint(merge({ fix: true }, param)))
    .pipe(reload({stream: true, once: true}))
    .pipe($.eslint.format())
    .pipe($.if(!browserSync.active, $.eslint.failAfterError()));
}

gulp.task('lint:scripts', () => {
  return lint(path.join(srcDir, '**', '*.{js, jsx}'))
    .pipe(gulp.dest(srcDir));
});

gulp.task('lint:html', () => {
  return gulp.src(path.join(srcDir, '**', '*.html'))
    .pipe($.htmlLint())
    .pipe($.htmlLint.format())
    .pipe($.if(!browserSync.active, $.htmlLint.failAfterError()))
    .pipe($.eslint({ fix: true }))
    .pipe(reload({ stream: true, once: true }))
    .pipe($.eslint.format())
    .pipe($.if(!browserSync.active, $.eslint.failAfterError()))
    .pipe(gulp.dest(srcDir));
});

gulp.task('lint:styles', () => {
  return gulp.src(path.join(srcDir, '**', '*.{css, scss}'))
    .pipe($.stylelint({
      reporters: [
        { formatter: 'string', console: true }
      ],
      failAfterError: false,
      debug: dev
    }))
    .pipe(reload({ stream: true, once: true }))
    .pipe($.stylefmt())
    .pipe(gulp.dest(srcDir));
});

gulp.task('lint:test', () => {
  return lint(path.join(testDir, 'spec', '**', '*.{js, jsx}'), {envs: ['mocha']})
    .pipe(gulp.dest(path.join(testDir, 'spec')));
});

gulp.task('lint', ['lint:styles', 'lint:scripts', 'lint:html']);

gulp.task('html', ['lint', 'styles', 'scripts'], () => {
  const dst = dev ? devDir : prodDir; 
  return gulp.src(path.join(srcDir, '**', '*.html'))
    .pipe($.inject(gulp.src(path.join(dst, '**', '*.{js,css}'), { read: false }), { ignorePath: dst }))
    .pipe($.if(!dev, $.htmlmin({
      collapseWhitespace: true,
      minifyCSS: true,
      minifyJS: { compress: { drop_console: true } },
      processConditionalComments: true,
      removeComments: true,
      removeEmptyAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true
    })))
    .pipe(gulp.dest(dst));
});

gulp.task('images', () => {
  return gulp.src('app/images/**/*')
    .pipe($.cache($.imagemin()))
    .pipe(gulp.dest('dist/images'));
});

gulp.task('fonts', () => {
  return gulp.src(require('main-bower-files')('**/*.{eot,svg,ttf,woff,woff2}', (err) => {})
    .concat('app/fonts/**/*'))
    .pipe($.if(dev, gulp.dest('.tmp/fonts'), gulp.dest('dist/fonts')));
});

gulp.task('extras', () => {
  return gulp.src([
    'app/*',
    '!app/*.html'
  ], {
    dot: true
  }).pipe(gulp.dest('dist'));
});

gulp.task('clean', del.bind(null, ['.tmp', 'dist']));

gulp.task('serve', () => {
  runSequence(['clean', 'wiredep'], ['styles', 'scripts', 'html', 'fonts'], () => {
    browserSync.init({
      notify: false,
      port: 9000,
      server: {
        baseDir: ['.tmp'],
        routes: {
          '/bower_components': 'bower_components'
        }
      }
    });

    gulp.watch([
      'app/images/**/*',
      '.tmp/fonts/**/*'
    ]).on('change', reload);

    gulp.watch('app/**/*.html', ['html']);    
    gulp.watch('app/styles/**/*.{css,scss}', ['styles']);
    gulp.watch('app/scripts/**/*.js', ['scripts']);
    gulp.watch('app/fonts/**/*', ['fonts']);
    gulp.watch('bower.json', ['wiredep', 'fonts']);
  });
});

gulp.task('serve:dist', ['default'], () => {
  browserSync.init({
    notify: false,
    port: process.env.PORT || 9000,
    open: false,
    server: {
      baseDir: ['dist']
    }
  });
});

gulp.task('test:css:reference', () =>
  backstop('reference')
);

gulp.task('test:css', () =>
  backstop('test')
);

gulp.task('test:css:showreport', () =>
  backstop('openReport')  
);

gulp.task('test:js', ['lint:test'], (done) => {
  new karma.Server({
    configFile: path.join(__dirname, 'karma.conf.js'),
    singleRun: true
  }, () => {
    done();
  }).start();
});

gulp.task('test', ['test:js']);

/**
 * Watch for file changes and re-run tests on each change
 */
gulp.task('test:js:server', (done) => {
  new karma.Server({
    configFile: path.join(__dirname, 'karma.conf.js')
  }, () => {
    done();
  }).start();
});

// inject bower components
gulp.task('wiredep', () => {
  gulp.src('app/*.html')
    .pipe(wiredep({
      ignorePath: /^(\.\.\/)*\.\./
    }))
    .pipe(gulp.dest('app'));
});

gulp.task('build', ['lint', 'html', 'images', 'fonts', 'extras'], () => {
  return gulp.src('dist/**/*').pipe($.size({title: 'build', gzip: true}));
});

gulp.task('default', () => {
  return new Promise(resolve => {
    runSequence(['clean', 'wiredep'], 'build', resolve);
  });
});