"use strict";
//load the env variables
require("dotenv").config({
	path: __dirname + "/.env",
	silent: true
});

const gulp = require("gulp");
const $ = require("gulp-load-plugins")();
const gutil = require("gulp-util");
const moment = require("moment");
const packageJSON = require("./package.json");
const _ = require("lodash");
const argv = require("yargs").argv;
const del = require("del");
const util = require("util");
const minify = require('gulp-minify');
const jsonminify = require('gulp-jsonminify');

const srcs = ["./**", "./.ebextensions/**", "./lib/**", "./.npmrc", "!./README.md", "!./gulpfile.js", "!./node_modules/", "!./node_modules/**", "!./swagger/", "!./swagger/**", "!./cf-templates/", "!./cf-templates/**", "!./dist/", "!./dist/**"];

gulp.task('minify', function (done) {
	gulp.src(['./settings.js'])
		.pipe(minify({
			ext: {
				src: '-debug.js',
				min: '.js'
			}
		}))
		.pipe(gulp.dest('minified'));
	done();
});

//Gulp build task
gulp.task("build", function (done) {
	runBuild().then(function (buildFile) {
		done();
	});
});
/**
 * Run build task
 * @param {Boolean} silent
 * @return {Promise}
 */
let runBuild = (silent) => {
	return new Promise(function (resolve, reject) {
		let distFileName = packageJSON.version.trim() + "-" + _.kebabCase(packageJSON.name.toLowerCase()) + "-" + moment().format("Y.M.D_H_mm_ss") + ".zip";
		del(["./dist/**"]).then(function () {
			if (silent !== true) {
				gutil.log([
					gutil.colors.white("Cleaned up"),
					gutil.colors.magenta("dist"),
					gutil.colors.white("folder")
				].join(" "));
			}
			gulp.src(["**/.ebextensions/*", ".npmrc", "minified/**/settings.js", "package.json", "package-lock.json"])
				.pipe($.zip(distFileName))
				.pipe(gulp.dest("dist"))
				.on("end", function () {
					if (silent !== true) {
						gutil.log([
							gutil.colors.white("Created package"),
							gutil.colors.magenta(distFileName),
							gutil.colors.white("under"),
							gutil.colors.magenta("dist"),
							gutil.colors.white("folder")
						].join(" "));
					}
					resolve(distFileName);
				})
				.on('error', function (err) {
					reject(err);
				})
		});
	});
}
//Gulp deploy task
//do the deployment task
gulp.task('deploy', (done) => {
	// as a stub, return true for the time being
	// gutil.log('This method is under construction');
	// return true;
	let environment = argv.e ? argv.e : 'staging';
	//check for the environment variables and give error if missing
	if (_.isUndefined(process.env.EB_DEPLOY_ACCESS_KEY_ID) || _.isUndefined(process.env.EB_DEPLOY_SECRET_ACCESS_KEY)) {
		gutil.log(gutil.colors.red('ERROR: You need to set the environment variables for EB to deploy'))
		gutil.log(gutil.colors.white('EB_DEPLOY_ACCESS_KEY_ID=<aws access key id for EB access>'));
		gutil.log(gutil.colors.white('EB_DEPLOY_SECRET_ACCESS_KEY=<aws secret access key for EB access>'));
		process.exit(1);
		done();
	}
	//show usage
	gutil.log(gutil.colors.white('Running for environment: ' + gutil.colors.magenta(environment)));
	gutil.log(gutil.colors.white(util.format('To run for specific environment use: ' + gutil.colors.black.bgWhite('%s -e %s'), argv.$0, '<environment name, prod or staging>')));
	runBuild(false).then(function (distFile) {
		gulp.src(srcs, {
				base: './'
			})
			.pipe($.elasticbeanstalkDeploy({
				name: packageJSON.name,
				version: distFile.replace(/\.(zip|gz|tar)$/, ''),
				timestamp: false, // optional: If set to false, the zip will not have a timestamp
				waitForDeploy: true, // optional: if set to false the task will end as soon as it is deploying
				amazon: {
					accessKeyId: process.env.EB_DEPLOY_ACCESS_KEY_ID,
					secretAccessKey: process.env.EB_DEPLOY_SECRET_ACCESS_KEY,
					region: process.env.EB_DEPLOY_S3_REGION || '',
					bucket: process.env.EB_DEPLOY_S3_BUCKET || '',
					applicationName: process.env.EB_DEPLOY_APPLICATION_NAME || '',
					versionLabel: distFile.replace(/\.(zip|gz|tar)$/, ''),
					environmentName: (environment === 'staging' ? process.env.EB_DEPLOY_ENVIRONMENT_NAME : process.env.EB_DEPLOY_ENVIRONMENT_NAME_PROD) || ''
				}
			}))
			.on('error', function (err) {
				gutil.log(gutil.colors.red('Error: ' + err.message));
				done();
			})
			//this will be called at the end of the process
			.on('data', function (d) {
				done();
			});
	});
});