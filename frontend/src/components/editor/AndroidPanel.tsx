import { useEffect, useState } from "react";
import { AdbDevices } from "../../../wailsjs/go/main/App";

interface Device {
  serial: string;
  state: string;
  model: string;
  manufacturer: string;
  brand: string;
  product: string;
  device: string;
  android: string;
  sdk: string;
  transportId: string;
}

interface AndroidPanelProps {
  onBack: () => void;
}

export default function AndroidPanel({ onBack }: AndroidPanelProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadDevices() {
    try {
      setLoading(true);
      const res = await AdbDevices();
      setDevices(res);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDevices();
  }, []);

  return (
    <div className='h-full bg-panel flex flex-col'>
      <div className='flex items-center justify-between px-3 py-2 border-b border-subtle'>
        <span className='text-[11px] uppercase tracking-wider text-tertiary'>
          Android
        </span>

        <div className='flex gap-1'>
          <button
            onClick={loadDevices}
            className='text-xs px-2 py-1 rounded hover:bg-hover'
          >
            Refresh
          </button>

          <button
            onClick={onBack}
            className='text-xs px-2 py-1 rounded hover:bg-hover'
          >
            Back
          </button>
        </div>
      </div>

      <div className='flex-1 overflow-auto'>
        {loading ? (
          <div className='p-4 text-sm text-tertiary'>Detecting devices...</div>
        ) : devices.length === 0 ? (
          <div className='p-4 text-sm text-tertiary'>
            No ADB devices connected.
          </div>
        ) : (
          devices.map((device) => (
            <button
              key={device.serial}
              className='w-full text-left px-4 py-3 border-b border-subtle hover:bg-hover transition'
            >
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm text-primary font-medium'>
                    {device.model}
                  </p>

                  <p className='text-xs text-tertiary'>
                    {device.manufacturer} • Android {device.android}
                  </p>

                  <p className='text-[11px] text-tertiary mt-1'>
                    {device.serial}
                  </p>
                </div>

                <span
                  className={`text-xs ${
                    device.state === "device"
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {device.state}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
