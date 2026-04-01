const statusStyles = {
  nova: "bg-blue-500/20 text-blue-400",
  interessante: "bg-green-500/20 text-green-400",
  descartada: "bg-gray-500/20 text-gray-400",
  pendente: "bg-yellow-500/20 text-yellow-400",
  enviada: "bg-green-500/20 text-green-400",
  falhou: "bg-red-500/20 text-red-400",
  respondida: "bg-purple-500/20 text-purple-400",
};

const statusLabels = {
  nova: "Nova",
  interessante: "Interessante",
  descartada: "Descartada",
  pendente: "Pendente",
  enviada: "Enviada",
  falhou: "Falhou",
  respondida: "Respondida",
};

export default function BadgeStatus({ status }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        statusStyles[status] || "bg-gray-500/20 text-gray-400"
      }`}
    >
      {statusLabels[status] || status}
    </span>
  );
}
