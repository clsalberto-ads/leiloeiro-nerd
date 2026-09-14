import { SettingsForm } from "./settings-form";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Configurações</h1>
      <SettingsForm />
    </div>
  );
}