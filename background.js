// TODO: use underscore
//       use backbone
/* global: model */
var background = {
	loadConfig: function()
	{
		console.log("loadConfig");
		if(background.timeout_token)
			clearInterval(this.timeout_token);
		
		model.config.stash_base_url = localStorage["stash_config.stash_base_url"];
		model.config.interval = localStorage["stash_config.interval"];

		background.test_stash();
		
		background.requests.get_status("QAMIIWS-3885", function(item) {
			console.log(item);
		});

		background.requests.get_transitions("QAMIIWS-3885", function(item) {
			console.log(item);
		});

		return !!this.timeout_token;
	},
	test_stash: function() {
		var project = "UZ";
		
		background.requests.stash_repos(project, function(repos) { 
			console.log(repos);

			$.each(repos, function(index, repo) {
				background.requests.merged_pullrequest_mine(project, "jcoscolla", repo, function (pullrequest) {
					var pp = pullrequest.map( function(item) {
						console.log(item);
						background.requests.commit_messages(project, repo, item, function (messages) {
							console.log(messages);
							var jira_codes = messages.map(function(msg) {
								var regex = /#([A-Z\-]+[0-9]*)/g,
								matches = regex.exec(msg);
								return matches ? matches[1] : null;
							});
							jira_codes = jira_codes.filter(function(i){ return i;});
							console.log(jira_codes);
							return jira_codes;
						});
					});
					console.log(pullrequest);
					console.log(pp);
				});
			});
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
			}).fail(function( jqxhr, status, error) {
				console.log("error get_status " + issue );
			});
		},
		get_transitions: function( issue, cb) {
			var url = "http://uzjira.atlassian.net/rest/api/2/issue/" + issue + "/transitions";
			$.getJSON(url, {}).done(function (json) {
				var transitions = $.map(json["transitions"], function( item ) {
					return {"id": item["id"], "name": item["name"] };
				});

				cb(transitions);
			}).fail(function( jqxhr, status, error) {
				console.log("error get_status " + issue );
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
