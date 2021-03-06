const gulp = require('gulp');
const fs = require('fs');
const path = require('path');
const util = require("gulp-util");
const gulpLoadPlugins = require('gulp-load-plugins');
const nunjucksRender = require('gulp-nunjucks-render');
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
const bowerMain = require('bower-main');

const $ = gulpLoadPlugins();
const reload = browserSync.reload;

const appDir = 'app';
const srcDir = path.join(appDir, 'resources');
const pageDir = path.join(appDir, 'pages');
const templateDir = path.join(appDir, 'templates');
const testDir = 'test';
const devDir = '.tmp';
const prodDir = 'dist';

const dev = !util.env.production;

if (dev) {
  var karma = require('karma');
  var backstop = require('backstopjs');
}

const bowerMainJavaScriptFiles = bowerMain('js','min.js');
const bowerMainCSSFiles = bowerMain('css', 'min.css');

const dst = dev ? devDir : prodDir;
const jsVendorFiles = dev ? bowerMainJavaScriptFiles.normal : bowerMainJavaScriptFiles.minified.concat(bowerMainJavaScriptFiles.minifiedNotFound);
const cssVendorFiles = dev ? bowerMainCSSFiles.normal : bowerMainCSSFiles.minified.concat(bowerMainCSSFiles.minifiedNotFound);

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
    .pipe(gulp.dest(path.join(dst, 'styles')))
    .pipe(reload({stream: true}));
});

gulp.task('scripts', ['lint:scripts'], () => {
  return browserify({ entries: path.join(srcDir, 'scripts', 'app.js'), debug: dev})
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
    .pipe(gulp.dest(path.join(dst, 'scripts')))
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
      failAfterError: false
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

gulp.task('copy:vendor:js', () => {
  return gulp.src(jsVendorFiles, {base: appDir})
    .pipe(gulp.dest(dst));
});

gulp.task('copy:vendor:css', () => {
  return gulp.src(cssVendorFiles, {base: appDir})
    .pipe(gulp.dest(dst));
});

gulp.task('copy:vendor', ['copy:vendor:js', 'copy:vendor:css']);

gulp.task('html', ['lint', 'styles', 'scripts', 'copy:vendor'], () => {
  return gulp.src([
      path.join(appDir, '**', '*.html'),
      path.join(pageDir, '**', '*.nunjucks')
    ])
    .pipe($.plumber())
    .pipe($.data(() => {
      return JSON.parse(fs.readFileSync(path.join(appDir, 'data.json')))
    }))
    .pipe($.nunjucksRender({
      path: [templateDir]
    }))  
    .pipe($.inject(gulp.src(
      [
        path.join(dst, '**', '*.{js,css}'),
        '!' + path.join(dst, 'vendor', '**', '*')
      ], { read: false }), { ignorePath: dst }))
    .pipe($.inject(gulp.src(cssVendorFiles.concat(jsVendorFiles), { read: false, base: appDir }), { name: 'bower' , ignorePath: appDir}))
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
  return gulp.src(path.join(srcDir, 'images', '**', '*'))
    .pipe($.cache($.imagemin()))
    .pipe(gulp.dest(path.join(dst, 'images')));
});

gulp.task('fonts', () => {
  return gulp.src(require('main-bower-files')().concat(path.join(srcDir, 'fonts','**','*')))
    .pipe($.filter('**/*.{eot,svg,ttf,woff,woff2}'))
    .pipe($.flatten())
    .pipe(gulp.dest(path.join(dst, 'fonts')));
});

gulp.task('extras', () => {
  return gulp.src([
    path.join(srcDir, '*.*'),
    '!' + path.join(srcDir, '*.html')
  ], {
    dot: true
  }).pipe(gulp.dest(dst));
});

gulp.task('clean', del.bind(null, [devDir, prodDir]));

gulp.task('serve', () => {
  runSequence('clean', ['styles', 'scripts', 'html', 'fonts', 'images'], () => {
    browserSync.init({
      notify: false,
      port: process.env.PORT || 9000,
      open: dev ? true : false,
      server: {
        baseDir: [dst]
      }
    });
    if (dev) {
      gulp.watch(
        path.join(srcDir, 'images', '**', '*')
      ).on('change', reload);

      gulp.watch(path.join(srcDir, '**', '*.html'), ['html']);
      gulp.watch(path.join(srcDir, '**', '*.{css, scss}'), ['styles']);
      gulp.watch(path.join(srcDir, '**', '*.{js, jsx}'), ['scripts']);
      gulp.watch(path.join(srcDir, 'fonts', '**', '*'), ['fonts']);
      gulp.watch('bower.json', ['wiredep', 'fonts']);
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
gulp.task('test:js:server', ['lint:test'], (done) => {
  new karma.Server({
    configFile: path.join(__dirname, 'karma.conf.js')
  }, () => {
    done();
  }).start();
});

gulp.task('build', ['lint', 'html', 'images', 'fonts', 'extras'], () => {
  return gulp.src(path.join(dst, '**','*')).pipe($.size({title: 'build:' + (dev ? 'dev': 'prod'), gzip: true}));
});

gulp.task('default', () => {
  return new Promise(resolve => {
    runSequence('clean', 'build', resolve);
  });
});