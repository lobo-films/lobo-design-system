import type { Meta, StoryObj } from '@storybook/react-vite';
import { TestComponent } from './TestComponent';

const meta = {
  title: 'test/TestComponent',
  component: TestComponent,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    text: 'this is a test component',
  },
} satisfies Meta<typeof TestComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    text: 'This is a test 1',
  },
};

export const Test2: Story = {
  args: {
    text: 'This is the second test',
  },
};
