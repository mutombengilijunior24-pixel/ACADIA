export default function Loader() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-5 w-5 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>

      <span className="text-gray-600 font-medium">
        Chargement...
      </span>
    </div>
  );
}