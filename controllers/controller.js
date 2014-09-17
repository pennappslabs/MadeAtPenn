var Project = require('../models/projects').Project;
var User = require('../models/users').User;
var Tag = require('../models/tag').Tag;
var mongoose = require('mongoose');
var async = require("async");
var knox = require('knox');
var fs=require('fs');
var SHA3 = require("crypto-js/sha3");
var sys=require('sys');
var sendgrid  = require('sendgrid')('pennlabs', 'spam4eva');
var credentials = require("../config.json");

var client = knox.createClient({
	key: credentials.accessKeyId,
	secret: credentials.secretAccessKey,
	bucket: 'penn-open-source'
});

var ObjectId= mongoose.Types.ObjectId;

//Page: homepage
exports.index = function(req, res) {
	Project.list(function (err, projects) {
		if(err) {
			return res.send(404);
		} else {
			return res.render("main.ejs", {projects: projects});
		}
	})
};

//Page: image upload page
exports.upload_page = function(req, res) {
	res.render("image.ejs", {id: req.params.id});
};


//Page: homepage
exports.startups = function(req, res) {
	Project.list(function (err, projects) {
		if(err) {
			return res.send(404);
		} else {
			return res.render("startups.ejs", {projects: projects});
		}
	})
};


//Page: homepage
exports.projects = function(req, res) {
	Project.list(function (err, projects) {
		if(err) {
			return res.send(404);
		} else {
			return res.render("projects.ejs", {projects: projects});
		}
	});
};

//Page: admin page
exports.admin = function(req, res) {
	if(req.session.logged) {
		Project.list(function (err, projects) {
			if(err) {
				return res.send(404);
			} else {
				return res.render("admin.ejs", {projects: projects});
			}
		});
	} else {
		return res.redirect('/login');
	}
};

//Page: login page
exports.login = function(req, res) {
	return res.render("login.ejs");
};

//Page: create account page 
exports.create_account_page = function(req, res) {
	return res.render("createaccount.ejs");
};

//Page: faq
exports.faq = function(req, res) {
	res.render("faq.ejs");
};


//Page: submit page
exports.submit = function(req, res) {
	res.render("submit.ejs", {error: "lalal"});
}

//Page: filters images by tag
exports.filter_by_tag = function(req, res) {
	var tag_name = req.params.tag;
	Tag.list(tag_name, function(err, project_names) {
		if(err) {
			return res.send(404);
		} else {
			var arr_projects = []
			for(var i=0; i<project_names.length; i++) {
				if(project_names[i] !== '') {
					arr_projects.push(project_names[i].app_name);
				}
			}
			Project.queryMultipleByName(arr_projects, function(err, projects) {
				if(err) {
					return res.send(404);
				} else { 
					console.log("querying multiple projects already")

					return res.render("main.ejs", {projects: projects});
				}
			});
		}
	});
};

//opens edit page for a single project
exports.edit = function(req, res) {
		Project.queryById(req.params.id, function(err, project) {
			return res.render("edit.ejs", {projects: project[0]});
		});
	};


/*--------------  Helper functions ----------- */

//logs out
exports.logout = function(req, res) {
	req.session.logged = false;
	req.session.username = "";
	return res.redirect("/");
};

//creates user account
exports.create_account = function(req, res) {
	console.log("account");
	var user = new User({
			username : req.body.username,
			password : SHA3(req.body.password).toString(),
			});
		user.save(function(err, proj) {
			if(err) {console.log(err);}
			else {
				res.redirect('/login');
			}
		});
};

//check login
exports.check_login = function(req, res) {
	var username = req.body.username;
	console.log("username:" + username);
	var password = SHA3(req.body.password).toString();
	console.log("password:" + password);

	User.findOne({username: username}, function(err, user) {
		console.log(user);
		if(err) {
			console.log(err);
			return res.redirect('/login');
		} else if (user.username == username && user.password == password) {
			console.log("logged in");
			req.session["logged"] = true;
			req.session["username"] = username;
			return res.redirect('/admin');
		} else {
			return res.redirect('/login');
		}
	}); 
};

//handles upload function
exports.upload = function(req, res) {
		var id = req.body.id;
		console.log(id);
		fs.readFile(req.files.image.path, function(err, data) {
			console.log(req.files.image.path);
			client.putFile(req.files.image.path, 'images/' + id + ".jpg", {'Content-Type': 'image/jpeg', 'x-amz-acl':'public-read'}, function(err, result) {
				if (err) { 
					console.log('Failed to upload file to Amazon S3'); 
					console.log(err);
				return res.send(404);
			} else { 
				console.log('Uploaded to Amazon S3');
				return res.redirect('/');
			}		
		});
	});
};



//handles update for an edit page
exports.update_project = function(req, res) {

	updates = {
		project_or_startup : req.body.project_or_startup,
		app_name : req.body.app_name,
		description : req.body.description,
		demo_link : req.body.demo,
		location : req.body.location,
		technologies : req.body.technologies,
		tags : req.body.tags,
		builders : req.body.builders,
		date : req.body.date,
		contact : req.body.contact,
		github_permis : req.body.github_permis,
		github : req.body.github,
		personal : req.body.personal,
		approved : req.body.approved,
	}
	var options = {upsert: true};

	Project.findOneAndUpdate({"_id": new ObjectId(req.body.id)}, updates, options, function(err, data) {
		if(!err) {
			res.redirect("/admin");
		} 
		res.send(err);
	}); 
}

//for autocomplete in tags
exports.search_tags = function(req, res) {
	var tag_name = req.params.tag;
	Tag.search(tag_name, function(err, tag_names) {
		if(err) {
			return res.send(404);
		} else {
			return res.send('options.ejs', {elements: tag_names});
		}
	});
}

//finds single project based on id
exports.search_findOne = function(req, res) {
	var id = req.params.id;
	Project.queryById(id, function(err, project){
		return res.send(project);
	});
}


//creates new project
exports.create = function(req, res) {
	console.log("something");
	console.log(req.body.project_or_startup);
	var project = new Project({
		project_or_startup : req.body.project_or_startup,
		app_name : req.body.app_name,
		description : req.body.description,
		demo_link : req.body.demo,
		location : req.body.location,
		technologies : req.body.technologies,
		tags : req.body.tags,
		builders : req.body.builders,
		date : req.body.date,
		contact : req.body.contact,
		github_permis : req.body.github_permis,
		github : req.body.github,
		personal : req.body.personal,
		approved : req.body.approved,
		});

	project.save(function(err, proj) {
		if(err) {console.log(err);}
		else {
			
			async.parallel(
				[
					function(callback) {
						var email     = new sendgrid.Email({
							to:       req.body.contact,
							from:     'pennappslabs@gmail.com',
							subject:  '[MadeAtPenn] Thanks for your submission!',
						});
						email.setHtml('<p>Hey there! <br /> Thanks for submitting to MadeAtPenn. '+ 
						 			'We\'re incredibly excited to check out what you made! You\'ll get another email once ' +
									'your app has been approved and published online! In the meantime, be sure check out '+
									'your classmate\'s hacks <a href="madeatpenn.pennlabs.org">here</a>! <br /> Sincerely, <br /> Penn Labs</p>');
						sendgrid.send(email, function(err, json) {
						  if (err) { return console.error(err); }
						  console.log(json);
						  callback();
						});
					},
					function(callback) {
						var tags = req.body.tags.split(/,| /);
						async.each(tags, function(tag_name, callback) {
							var tag = new Tag({
								tag: tag_name,
								app_name : req.body.app_name
							})
							tag.save(callback());
						});
						callback();
					}
				], 	function(err) {
						if(err == null) {
							res.redirect('/');
						}
					}
			);
		}
	});
};