interface ShareHeaderProps {
  organization: {
    name: string;
    logoData: string;
    logoMimeType: string;
  };
}

export function ShareHeader({ organization }: ShareHeaderProps) {
  const logoUrl = `data:${organization.logoMimeType};base64,${organization.logoData}`;

  return (
    <div className="flex items-center gap-3 px-6 py-3 bg-white border-b">
      <img
        src={logoUrl}
        alt={organization.name}
        className="w-10 h-10 object-contain"
      />
      <span className="font-semibold text-lg">{organization.name}</span>
    </div>
  );
}
