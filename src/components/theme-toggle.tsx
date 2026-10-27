import { Moon, Sun } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useTheme } from '../lib/theme';

/**
 * Light/dark switch for the editor shell.
 *
 * The button shows the mode it switches *to*: a sun while the shell is dark.
 */
export const ThemeToggle = () => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const next = resolvedTheme === 'dark' ? 'light' : 'dark';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={`Switch to ${next} mode`}>
          {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{next === 'dark' ? 'Dark mode' : 'Light mode'}</TooltipContent>
    </Tooltip>
  );
};
