// TODO: use underscore
//       use backbone
/* global: model */
Array.prototype.flatten = function() {
  return this.reduce(function(prev, cur) {
    var more = [].concat(cur).some(Array.isArray);
    return prev.concat(more ? cur.flatten() : cur);
  },[]);
};

var background = {
	loadConfig: function()
	{
		$.ajaxSetup({
			error: function(jqXHR, textStatus, errorThrow) {
				console.log(textStatus, errorThrow, jqXHR);
			}
		});

		console.log("loadConfig");
		if(background.timeout_token)
			clearInterval(this.timeout_token);
		
		model.config.stash_base_url = localStorage["stash_config.stash_base_url"];
		model.config.interval = localStorage["stash_config.interval"];

		background.test_stash();

		return !!this.timeout_token;
	},
	test_stash: function() {
		var project = "UZ";
		var username = "jcoscolla";

		var get_repos = function(callback) {
			background.requests.stash_repos(project, function(repos) { 
				callback(null, repos);
			});
		};

		var get_pullrequest = function (repos, callback) {
			async.map(repos, function(repo, callback) {
				background.requests.merged_pullrequest_mine(project, username, repo, function (pullrequests) {
					console.log(pullrequests);
					pullrequests = $.map(pullrequests, function(pr, i) {
						pr["repo"] = repo;
						return pr;
					});
					callback(null, pullrequests);
				});
			}, function(err, pullrequests) {
				pullrequests = pullrequests.flatten();
				callback(null, pullrequests);
			});
		};

		var get_messages = function(pullrequests, callback) {
			async.map(pullrequests, function(pr, callback) { 
				background.requests.commit_messages(project, pr["repo"], pr, function(msg) {
					pr["commit_messages"] = msg;
					callback(null, pr);
				});
			},function (err, result) {
				callback(result);
			});
		};

		var fill_jira_codes = function(pr) {
			
			var codes = $.map(pr["commit_messages"], function(msg, i) { 
				var regex = /#([A-Z\-]+[0-9]*)/g,
					matches = regex.exec(msg);
				return matches ? matches[1] : null;
			});
			
			pr["jira"] = codes;
			return pr;
		};

		async.waterfall([get_repos, get_pullrequest, get_messages],
						function (result) {
							result = $.map(result, fill_jira_codes);
							
							async.map(result, 
									  function(pr, callback) { 
										  if(pr["jira"]) {
											  pr["jira_status"] = [];

											  async.map(pr["jira"], function(jira_code, callback) {
												  background.requests.get_status(jira_code, function(status) { 
													  pr["jira_status"].push(status);
													  callback(null, pr);
												  });
											  }, function (err, result) {
												  callback(null, result);
											  });
										  }else{
											  callback(null, null);
										  }
									  },
									  function(err, result) {
										  result = result.flatten();
										  console.log(result);
									  } );
						});
			
	},
	startTimeout: function(f)
	{
		if(!model.config.interval || !model.config.stash_base_url)	
			background.changeIcon("CONF");
		else
			this.timeout_token = setInterval(f, model.config.interval* 1000);
	},
	onTimeout: function()
	{
		background.requests.pull_requests("open", function(res){
			if(res.ok)
			{
				background.changeIcon(res.result.size + " /" + res.author_data.size);
				var change = model.open_pullrequest.size < res.result.size;
				if(change)
					background.createNotification("Number pull requests: " + res.result.size);
				model.open_pullrequest = res.result;
			}
			else
				background.changeIcon(res.error.error);
		});
	},
	changeIcon: function(text)
	{
		chrome.browserAction.setBadgeText({text: ""+text});
	},
	createNotification: function(text) 
	{
		var not = webkitNotifications.createNotification("icon_48.png", "Stash extension", text);
		not.show();
		setTimeout(function() {
			not.cancel();
		},5000);
	},
	requests: {
		construct_url: function(path)
		{
			return model.config.stash_base_url + path;
		},
		pull_requests: function(state, cb)
		{
			var url = this.construct_url("rest/inbox/latest/pull-requests?role=reviewer"),
			   _this = background.requests;
			$.getJSON(url, {start: 0, limit: 100, state: state, order: null, avatarSize: 64}, function (json){
				
				var url = _this.construct_url("rest/inbox/latest/pull-requests?role=author");
				$.getJSON(url, {start: 0, limit: 100, state: state, order: null, avatarSize: 64}, function (json2){
					cb(_this.response_ok(json, json2));
				}).error(function(xhr, status, error) {
					cb(_this.response_error(status, xhr.status));
				});
			}).error(function(xhr, status, error){
				cb(_this.response_error(status, xhr.status));
			});
		},
		merged_pullrequest_mine: function(project, username, repo, cb) {
			var url = this.construct_url("rest/api/1.0/projects/" + project + "/repos/" + repo + "/pull-requests?state=MERGED");
			$.getJSON(url, {}, function (json) {
				var data = json["values"].filter( function(item) {
					return item["author"]["user"]["name"] == "jcoscolla";
				});
				cb(data);
			});
		},
		commit_messages: function(project, repo, pr, cb) {
			var url = this.construct_url("rest/api/1.0/projects/" + project + "/repos/" + repo + "/pull-requests/" + pr.id + "/commits");
			$.getJSON(url, {}, function (json) {
				var messages = json["values"].map( function(item) {
					return item.message;
				});
				cb(messages);
			});
		},
		stash_repos: function( project, cb ) {
			var url = this.construct_url("rest/api/1.0/projects/" + project + "/repos");
			$.getJSON(url, {}, function (json) {
				var repos = json["values"].map( function(item) {
					return item["slug"];
				});
				cb(repos);
			});
		},
		get_status: function( issue, cb ) {
			var url = "http://uzjira.atlassian.net/rest/api/2/issue/" + issue;

			$.getJSON(url, {}).done(function (json) { 
				cb(json["fields"]["status"]["name"]);
			}).fail( function() {
				cb(null);
			});
		},
		get_transitions: function( issue, cb) {
			var url = "http://uzjira.atlassian.net/rest/api/2/issue/" + issue + "/transitions";
			$.getJSON(url, {}).done(function (json) {
				var transitions = $.map(json["transitions"], function( item ) {
					return {"id": item["id"], "name": item["name"] };
				});

				cb(transitions);
			});
			
		},
		response_ok: function(data, data2){
			return { 
				ok: true,  
				result: data,
				author_data: data2
			};
		},
		response_error: function(status, error)
		{
			return { 
				ok: false, 
				error: {
					status: status, 
					error: error
				}
			};
		}

}
};
document.addEventListener('DOMContentLoaded', function () {
	background.loadConfig();
	background.startTimeout(background.onTimeout);
	window.addEventListener('storage', function() { 
		background.loadConfig();
		background.startTimeout(background.onTimeout);
	}, false);

	chrome.browserAction.onClicked.addListener(function() {
		//chrome.tabs.create({'url': background.requests.config.base_url});
		//background.createNotification("TEST...");
	});
});
