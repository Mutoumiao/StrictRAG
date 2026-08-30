/** 测试 re-export；无全局 Provider（需要时在测文件内包）。 */
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

export { render, screen, waitFor, act, renderHook, cleanup } from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

/** 关闭列表：点触发器再点选项（不是原生 selectOptions）。 */
export async function pickClosedOption(
  user: ReturnType<typeof userEvent.setup>,
  fieldLabel: string,
  optionName: string | RegExp,
) {
  await user.click(await screen.findByLabelText(fieldLabel));
  await user.click(screen.getByRole('option', { name: optionName }));
}
