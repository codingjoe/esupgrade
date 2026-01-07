import jscodeshift from 'jscodeshift';
const j = jscodeshift.withParser('tsx');
const code = `const Template: StoryFn<MyType> = () => {
  return <div>Hello</div>;
};`;
const root = j(code);
root.find(j.VariableDeclarator).forEach(path => {
  console.log('Has typeAnnotation:', !!path.node.id.typeAnnotation);
  if (path.node.id.typeAnnotation) {
    console.log('typeAnnotation type:', path.node.id.typeAnnotation.type);
  }
});
