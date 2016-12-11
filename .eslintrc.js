// http://eslint.org/docs/user-guide/configuring
// docs for rules at http://eslint.org/docs/rules/{ruleName}
module.exports = {
    "env": {
        "browser": false,
        "commonjs": true,
        "mocha": true,
        "es6": true,
        "node": true
    },
    "extends": [
        "eslint:recommended",
        "airbnb-base"
    ],
    "globals": {},
    "rules": {
        // http://eslint.org/docs/rules/brace-style
        "indent": [
            "error",
            2
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "single"
        ],
        "semi": [
            "error",
            "always"
        ],
        "arrow-body-style": "off",
        "valid-jsdoc": "warn",
        "eol-last": "warn",
        "key-spacing": "off",
        "comma-dangle": "off",
        "object-shorthand": "off",
        "global-require": "off",
        "func-names": "off",
        "prefer-arrow-callback": "off",
        "padded-blocks": "warn",
        "prefer-template": "off",
        "vars-on-top": "off",
        "max-len": "off",
        "quote-props": "off",
        "no-unused-expressions": "off",
        "no-underscore-dangle": "off",
        "no-var": "off",
        "no-param-reassign": "warn",
        "no-console": "off",
        "spaced-comment": "off",
        "space-before-function-paren": "off",
        "import/no-extraneous-dependencies": [
            "warn",
            { "devDependencies": true }
        ],
        "no-restricted-syntax": [
            "error",
            "ArrowFunctionExpression",
            "ClassExpression"
        ]
    }
};
