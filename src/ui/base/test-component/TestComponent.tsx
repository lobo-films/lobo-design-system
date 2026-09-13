export interface TestComponentType {
  text: string;
}

/** Primary UI component for user interaction */
export const TestComponent = ({ text }: TestComponentType) => {
  return <h1>{text}</h1>;
};
