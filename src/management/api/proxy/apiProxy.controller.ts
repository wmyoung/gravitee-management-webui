/*
 * Copyright (C) 2015 The Gravitee team (http://gravitee.io)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import _ = require('lodash');
import angular = require('angular');
import SidenavService from '../../../components/sidenav/sidenav.service';
import UserService from '../../../services/user.service';
import ApiService from '../../../services/api.service';
import NotificationService from '../../../services/notification.service';
import GroupService from '../../../services/group.service';

class ApiProxyController {
  private initialApi: any;
  private initialDiscovery: any;

  private api: any;
  private groups: any;
  private categories: any;
  private tags: any;
  private tenants: any;
  private failoverEnabled: boolean;
  private contextPathEditable: boolean;
  private formApi: any;
  private apiPublic: boolean;
  private headers: string[];
  private discovery: any;
  private virtualHostModeEnabled: boolean;

  constructor(
    private ApiService: ApiService,
    private NotificationService: NotificationService,
    private UserService: UserService,
    private $scope,
    private $mdDialog,
    private $mdEditDialog,
    private $rootScope,
    private $state,
    private GroupService: GroupService,
    private SidenavService: SidenavService,
    private resolvedCategories,
    private resolvedGroups,
    private resolvedTags,
    private resolvedTenants,
    private userTags
  ) {
    'ngInject';

    this.ApiService = ApiService;
    this.NotificationService = NotificationService;
    this.UserService = UserService;
    this.GroupService = GroupService;
    this.$scope = $scope;
    this.$rootScope = $rootScope;
    this.$mdEditDialog = $mdEditDialog;
    this.$mdDialog = $mdDialog;
    this.initialApi = _.cloneDeep(this.$scope.$parent.apiCtrl.api);
    this.api = _.cloneDeep(this.$scope.$parent.apiCtrl.api);
    this.discovery = this.api.services && this.api.services.discovery;
    this.discovery = this.discovery || {enabled: false, configuration: {}};
    this.initialDiscovery = _.cloneDeep(this.discovery);
    this.tenants = resolvedTenants.data;
    this.$scope.selected = [];

    this.$scope.searchHeaders = null;

    this.api.labels = this.api.labels || [];

    this.virtualHostModeEnabled = this.api.proxy.virtual_hosts.length > 1 || this.api.proxy.virtual_hosts[0].host !== undefined;

    this.$scope.lbs = [
      {
        name: 'Round-Robin',
        value: 'ROUND_ROBIN'
      }, {
        name: 'Random',
        value: 'RANDOM'
      }, {
        name: 'Weighted Round-Robin',
        value: 'WEIGHTED_ROUND_ROBIN'
      }, {
        name: 'Weighted Random',
        value: 'WEIGHTED_RANDOM'
      }];

    this.$scope.methods = ['GET', 'DELETE', 'PATCH', 'POST', 'PUT', 'OPTIONS', 'TRACE', 'HEAD'];

    this.initState();

    this.categories = resolvedCategories;

    this.tags = resolvedTags;
    this.groups = resolvedGroups;

    this.headers = ApiService.defaultHttpHeaders();

    this.$scope.$on('apiChangeSuccess', (event, args) => {
      this.api = args.api;
    });
  }

  toggleVisibility() {
    if (this.api.visibility === 'public') {
      this.api.visibility = 'private';
    } else {
      this.api.visibility = 'public';
    }
    this.formApi.$setDirty();
  }

  initState() {
    this.$scope.apiEnabled = (this.$scope.$parent.apiCtrl.api.state === 'started');
    this.$scope.apiPublic = (this.$scope.$parent.apiCtrl.api.visibility === 'public');

    // Failover
    this.failoverEnabled = (this.api.proxy.failover !== undefined);

    // Context-path editable
    this.contextPathEditable = this.UserService.currentUser.id === this.api.owner.id;

    this.api.proxy.cors = this.api.proxy.cors || {allowOrigin: [], allowHeaders: [], allowMethods: [], exposeHeaders: [], maxAge: -1, allowCredentials: false};
  }

  removeEndpoints() {
    var _that = this;
    let that = this;
    this.$mdDialog.show({
      controller: 'DialogConfirmController',
      controllerAs: 'ctrl',
      template: require('../../../components/dialog/confirmWarning.dialog.html'),
      clickOutsideToClose: true,
      locals: {
        title: 'Are you sure you want to delete endpoint(s) ?',
        msg: '',
        confirmButton: 'Delete'
      }
    }).then(function (response) {
      if (response) {
        _(_that.$scope.selected).forEach(function (endpoint) {
          _(_that.api.proxy.groups).forEach(function (group) {
            _(group.endpoints).forEach(function (endpoint2, index, object) {
              if (endpoint2 !== undefined && endpoint2.name === endpoint.name) {
                object.splice(index, 1);
              }
            });
          });
        });

        that.update(that.api);
      }
    });
  }

  reset() {
    this.api = _.cloneDeep(this.initialApi);
    this.discovery = _.cloneDeep(this.initialDiscovery);

    this.initState();

    if (this.formApi) {
      this.formApi.$setPristine();
      this.formApi.$setUntouched();
    }
  }

  delete(id) {
    let that = this;
    this.$mdDialog.show({
      controller: 'DialogConfirmController',
      controllerAs: 'ctrl',
      template: require('../../../components/dialog/confirmWarning.dialog.html'),
      clickOutsideToClose: true,
      locals: {
        title: 'Are you sure you want to delete \'' + this.api.name + '\' API ?',
        msg: '',
        confirmButton: 'Delete'
      }
    }).then(function (response) {
      if (response) {
        that.ApiService.delete(id).then(() => {
          that.NotificationService.show('API \'' + that.initialApi.name + '\' has been removed');
          that.$state.go('management.apis.list', {}, {reload: true});
        });
      }
    });
  }

  onApiUpdate(updatedApi) {
    this.api = updatedApi;
    this.initialApi = _.cloneDeep(updatedApi);
    this.initState();
    this.formApi.$setPristine();
    this.$rootScope.$broadcast('apiChangeSuccess', {api: _.cloneDeep(updatedApi)});
    this.NotificationService.show('API \'' + this.initialApi.name + '\' saved');
    this.SidenavService.setCurrentResource(this.api.name);
  }

  update(api) {
    if (!this.failoverEnabled) {
      delete api.proxy.failover;
    }
    this.ApiService.update(api).then(updatedApi => {
      updatedApi.data.etag = updatedApi.headers('etag');
      this.onApiUpdate(updatedApi.data);
    });
  }

  getTenants(tenants) {
    if (tenants !== undefined) {
      return _(tenants)
        .map((tenant) => _.find(this.tenants, {'id': tenant}))
        .map((tenant: any) => tenant.name)
        .join(', ');
    }

    return '';
  }

  hasTenants(): boolean {
    return this.tenants && this.tenants.length;
  }

  getGroup(groupId) {
    return _.find(this.groups, { 'id': groupId });
  }

  /**
   * Search for HTTP Headers.
   */
  querySearchHeaders(query) {
    return query ? this.headers.filter(this.createFilterFor(query)) : [];
  }

  /**
   * Create filter function for a query string
   */
  createFilterFor(query) {
    let lowercaseQuery = angular.lowercase(query);

    return function filterFn(header) {
      return angular.lowercase(header).indexOf(lowercaseQuery) === 0;
    };
  }

  createGroup() {
    this.$state.go('management.apis.detail.proxy.group', {groupName: ''});
  }

  deleteGroup(groupname) {
    let that = this;
    this.$mdDialog.show({
      controller: 'DialogConfirmController',
      controllerAs: 'ctrl',
      template: require('../../../components/dialog/confirmWarning.dialog.html'),
      clickOutsideToClose: true,
      locals: {
        title: 'Are you sure you want to delete group ' + groupname + '?',
        msg: '',
        confirmButton: 'Delete group'
      }
    }).then(function (response) {
      if (response) {
          _(that.api.proxy.groups).forEach(function (group, index, object) {
            if (group.name !== undefined && group.name === groupname) {
              object.splice(index, 1);
              that.update(that.api);
            }
          });
      }
    });
  }

  hasHealthCheck(endpoint: any) {
    if (endpoint.backup) {
      return false;
    }

    if (endpoint.healthcheck !== undefined) {
      return endpoint.healthcheck.enabled;
    } else {
      return (this.api.services &&
        this.api.services['health-check'] &&
        this.api.services['health-check'].enabled);
    }
  }

  isTagDisabled(tag: any): boolean {
    return !_.includes(this.userTags, tag.id);
  }

  controlAllowOrigin(chip, index, ev) {
    if ('*' === chip) {
      let that = this;
      this.$mdDialog.show({
        controller: 'DialogConfirmController',
        controllerAs: 'ctrl',
        template: require('../../../components/dialog/confirmWarning.dialog.html'),
        clickOutsideToClose: true,
        locals: {
          title: 'Are you sure you want to remove all cross-origin restrictions?',
          confirmButton: 'Yes, I want to allow all origins.'
        }
      }).then(function (response) {
        if (!response) {
          that.api.proxy.cors.allowOrigin.splice(index, 1);
        }
      });
    }
  }

  switchVirtualHostMode() {
    if (this.virtualHostModeEnabled) {
      let that = this;
      this.$mdDialog.show({
        controller: 'DialogConfirmController',
        controllerAs: 'ctrl',
        template: require('../../../components/dialog/confirmWarning.dialog.html'),
        clickOutsideToClose: true,
        locals: {
          title: 'Switch to context-path mode',
          msg: 'By moving back to context-path you will loose all virtual-hosts. Are you sure to continue?',
          confirmButton: 'Switch'
        }
      }).then(function (response) {
        if (response) {
          // Keep only the first virtual_host and remove the host
          that.api.proxy.virtual_hosts.splice(1);
          that.api.proxy.virtual_hosts[0].host = undefined;

          that.virtualHostModeEnabled = !that.virtualHostModeEnabled;

          that.update(that.api);
        }
      });
    } else if (this.formApi.$dirty) {
      this.virtualHostModeEnabled = !this.virtualHostModeEnabled;
      this.update(this.api);
    } else {
      this.virtualHostModeEnabled = !this.virtualHostModeEnabled;
    }
  }

  addVirtualHost() {
    if (this.api.proxy.virtual_hosts === undefined) {
      this.api.proxy.virtual_hosts = [];
    }

    this.api.proxy.virtual_hosts.push({host: undefined, path: undefined});
  }

  removeVirtualHost(idx) {
    if (this.api.proxy.virtual_hosts !== undefined) {
      this.api.proxy.virtual_hosts.splice(idx, 1);
      this.formApi.$setDirty();
    }
  }
}

export default ApiProxyController;
