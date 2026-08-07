/** 测试 re-export；无全局 Provider（需要时在测文件内包）。 */
export { render, screen, waitFor, act, renderHook, cleanup } from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';