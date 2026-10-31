import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';

export default function NavBar() {
  const navigate = useNavigate();

  return (
    <header className="w-full font-sans">
      {/* Top Ticker Bar */}
      <div className="w-full bg-[#000d29] text-[#8fa7d1] text-[11px] font-bold tracking-widest px-6 py-1.5 flex justify-between items-center border-b border-[#0a235c] uppercase">
        <div className="flex items-center gap-3">
          <span className="text-[#ff2e63]">BIDXI ENGINE</span>
          <span className="text-slate-600">|</span>
          <span>PREMIUM CRICKET AUCTION PLATFORM</span>
        </div>
        <div className="flex items-center gap-4">
          <span>IPL 2026 EDITION</span>
          <span className="text-[#00ff87] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff87] animate-pulse"></span>
            LIVE ROOMS ACTIVE
          </span>
        </div>
      </div>

      {/* Main Navigation Surface */}
      <nav className="w-full bg-[#001440] border-b-2 border-[#002b80] px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center bg-[#002b80] p-1.5 border border-[#1a52c8]">
            <div className="bg-[#ff2e63] text-white font-black italic text-2xl px-3 py-0.5 transform -skew-x-12">
              BID<span className="text-[#ffd700]">XI</span>
            </div>
          </Link>
          <span className="text-white font-black text-sm tracking-widest uppercase italic hidden sm:inline">
            FAN AUCTION PORTAL
          </span>
        </div>

        <div className="flex items-center gap-6">
          <a href="#how-it-works" className="text-white text-xs font-black tracking-widest uppercase hover:text-[#ff2e63] transition-colors hidden md:inline">
            HOW IT WORKS
          </a>
          <button
            onClick={() => navigate('/create-room')}
            className="bg-[#ff2e63] hover:bg-[#e02454] text-white font-black text-xs tracking-widest uppercase px-5 py-2.5 transform -skew-x-6 cursor-pointer"
          >
            CREATE ROOM
          </button>
        </div>
      </nav>
    </header>
  );
}