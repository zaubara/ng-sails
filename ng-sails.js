angular.module('ngSails', []).factory('$sails', ['$q','$rootScope',
	function($q,$rootScope) {

		var $sails = function(sailsmodel, angularmodel, $scope, params, subscribe) {
			this.length = 0;
			(function(sailsmodel, angularmodel, $scope) {
				if (!sailsmodel && !angularmodel) return;
				if (!$scope) {
					$scope = angularmodel;
					angularmodel = sailsmodel;
				}
				this.api = sailsmodel;
				this.model = angularmodel;
				this.hooks = {
					onfetch:[],
					onsubscribe:[]
				};
				this.params = {
					limit:300,
					skip:0,
					sort:'id desc'
				};
				if (params) angular.extend(this.params,params);
				this.scope = $scope;
				if (typeof subscribe !== 'undefined') this.fetch(subscribe);
				else this.fetch(true);

				console.log('ngsails: ', this.api, this.model);

			}.bind(this))(sailsmodel, angularmodel, $scope);
		}

		$sails.prototype = [];
		if (new $sails().length !== 0) {
			$sails.prototype = {};
			["join","pop","push","reverse","shift","slice","sort","splice","unshift","concat"].forEach(function(m) {
				$sails.prototype[m] = Array.prototype[m];
			});
		}
		$sails.prototype.toString = Object.prototype.toString;
		$sails.prototype.concat = function () { return Array.prototype.concat.apply(this.slice(), arguments);};
		$sails.prototype.responseHandler = function(response) {
			this.scope[this.model] = this.scope[this.model] || [];
			console.log('responseHandler called', response, this.scope[this.model], this.model, this.api);
			switch(response.verb) {
				case "created":
					if (this.params.sort === 'id desc' && this.params.skip === 0) {
						//console.log('created ngsails: ', response.data);
						this.scope[this.model].unshift(response.data);
						if (this.scope[this.model].length > ~~this.params.limit) this.scope[this.model] = this.scope[this.model].slice(0,Math.max(this.params.limit,0));
					}
					break;

				case "updated":
					var updateFound = false;
					this.scope[this.model].forEach(function(item) {
						if (item.id == response.id) { angular.extend(item,response.data); updateFound = true; }
					}.bind(this));
					if (!updateFound) this.fetch(false);
					break;

				case "destroyed":
					var performFetch = false;
					this.scope[this.model].forEach(function(item,key) {
						if (item.id == response.id) performFetch = true;
					}.bind(this));
					if (performFetch) this.fetch(false);
					break;
			}
			this.scope.$apply();
			return this;
		};
		$sails.prototype.fetch = function(subscribe) {
			//console.log('subscribe: ', this.api, subscribe);
			if (!this.api) return;
			io.socket.request((this.api.substr(0,1)!=="/"?'/':'')+this.api, this.params, function(response) {
				this.scope[this.model].length = 0;
				Array.prototype.push.apply(this.scope[this.model], response);
				this.scope.$apply();
				if (subscribe) this.subscribe();
				this.hooks.onfetch.forEach(function(hook) { hook(); });
			}.bind(this));
			return this;
		};
		$sails.prototype.subscribe = function() {
			//console.log('subscribe:', this.model, this.api, this.api.split('/')[0]);
			io.socket.on(this.api.split('/')[0], this.responseHandler.bind(this));
			this.hooks.onsubscribe.forEach(function(hook) { hook(); });
			return this;
		}
		$sails.prototype.subscribeUrl = function(url) {
			//console.log('subscribe:', this.model, url);
			io.socket.on(url, this.responseHandler.bind(this));
			this.hooks.onsubscribe.forEach(function(hook) { hook(); });
			return this;
		}
		$sails.prototype.where = function(where) {
			if (!this.params) this.params = this.defaultParams();
			this.params.where = where?where:{};
			this.fetch(false);
			return this;
		};
		$sails.prototype.crud = function(method, object, id) {
			//console.log('crud: ', method, this.model);
			var q = $q.defer(),
				object = object || {},
				method = (typeof method === "string"?method:"get").toLowerCase();
				io.socket[method]((this.api.substr(0,1)!=="/"?'/':'')+this.api+(id?'/'+id:''),object,function(data,response) {
					var verb = false;
					switch (method) {
						case "post":
							verb = "created";
							break;
						case "put":
							verb = "updated";
							break;
						case "delete":
							verb = "destroyed";
							break;
					}
					if (verb) this.responseHandler({verb:verb, id:data.id, data:data});
					if (response.statusCode == 200) return q.resolve(data);
					else console.log(data, response);
					q.reject(data);
				}.bind(this));
			return q.promise;
		};
		$sails.prototype.create = function(object) { return this.crud('post', object); };
		$sails.prototype.update = function(id, object) { return this.crud('put', object, id); };
		$sails.prototype.destroy = function(id, object) { return this.crud('delete', object, id); };
		$sails.prototype.retrieve = function(id, object) { return this.crud('get', object, id); };
		return $sails;

	}
]);
