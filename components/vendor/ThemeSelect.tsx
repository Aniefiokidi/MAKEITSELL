import { useTheme } from "next-themes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ThemeSelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
}

export default function ThemeSelect({ value, onValueChange }: ThemeSelectProps) {
  const { theme, setTheme } = useTheme();
  return (
    <Select value={value || theme} onValueChange={(v: string) => { setTheme(v); onValueChange?.(v); }}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="light">Light</SelectItem>
        <SelectItem value="dark">Dark</SelectItem>
        <SelectItem value="system">System</SelectItem>
      </SelectContent>
    </Select>
  );
}
