'use strict';

describe('Directive: commandLineHooksConfig', function() {

    // load the directive's module
    beforeEach(module('superProductivity'));
    beforeEach(module('templates'));

    var element,
        scope;

    beforeEach(inject(function($rootScope) {
        scope = $rootScope.$new();
    }));

    it('should do something', inject(function($compile) {
        element = $compile('<command-line-hooks-config></command-line-hooks-config>')(scope);
        scope.$digest();
        expect(true).toBe(true);
    }));
});