/**
 * A custom transformer in the "program" shape that ts-patch expects: the
 * factory receives the Program, the plugin's own config from tsconfig.json,
 * and an extras object carrying the TypeScript instance that loaded it.
 *
 * It deletes statements that are nothing but a call to debug(...), which is
 * the kind of job build-time transformers are used for. It touches nothing
 * else, so the emitted file is otherwise byte-identical to a plain build.
 */
module.exports = function debugStripper(program, pluginConfig, extras) {
  const ts = extras.ts;

  const isDebugCallStatement = (node) =>
    ts.isExpressionStatement(node) &&
    ts.isCallExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === 'debug';

  return (context) => (sourceFile) => {
    const visit = (node) => {
      if (isDebugCallStatement(node)) {
        return undefined;
      }
      return ts.visitEachChild(node, visit, context);
    };
    return ts.visitNode(sourceFile, visit);
  };
};
