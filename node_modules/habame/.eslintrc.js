
module.exports = {
    env: {
        browser: true,
        es2021: true
    },
    extends: ["eslint:recommended", "plugin:jsdoc/recommended"],
    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
    },
    plugins: [
        "eslint-plugin-jsdoc"
    ],
    rules: {
        "jsdoc/no-undefined-types": 0,
        "jsdoc/require-param-description": 0,
        "jsdoc/tag-lines": 0,
        "jsdoc/require-returns-description": 0,
        "jsdoc/check-types": 0,
        "eqeqeq": "error",
        "func-style": ["error", "expression"],
        "no-console": "error",
        "no-else-return": ["error", {allowElseIf: false}],
        "no-empty-function": ["error", { "allow": ["arrowFunctions"] }],
        "no-eval": "error",
        "no-var": "error",
        "no-useless-rename": "error",
        "semi": 2,
        "no-unused-vars": ["error", {
            "varsIgnorePattern": "^_"
        }]
    },
    settings: {
        jsdoc: {
            tagNamePreference: {
                "augments": {
                    "message": "@extends is to be used over @augments as it is more evocative of classes than @augments",
                    "replacement": "extends"
                }
            }
        }
    }
};