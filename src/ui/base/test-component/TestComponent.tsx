import './TestComponent.scss';

export interface TestComponentType {
  text: string;
}

/** Primary UI component for user interaction */
export const TestComponent = ({ text }: TestComponentType) => {
  return (
    <>
      <h1>{text}</h1>
      <h3>{text}</h3>
    </>
  );
};
