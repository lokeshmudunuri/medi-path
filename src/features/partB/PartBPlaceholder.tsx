import React from 'react';

/**
 * PartBPlaceholder
 * 
 * Boundary placeholder for Part B integration.
 * DO NOT implement Part B functionality here.
 * Isolated module boundary to allow future plug-in without restructuring Part A.
 */
export const PartBPlaceholder: React.FC = () => {
  return (
    <div className="container" style={{ padding: '4rem 1rem', maxWidth: '680px', textAlign: 'center' }}>
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '1rem',
        padding: '3rem 2rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{
          display: 'inline-block',
          padding: '0.4rem 1rem',
          background: '#f1f5f9',
          color: '#475569',
          borderRadius: '9999px',
          fontSize: '0.85rem',
          fontWeight: 700,
          marginBottom: '1.25rem',
          letterSpacing: '0.05em'
        }}>
          PART B INTEGRATION BOUNDARY
        </div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem' }}>
          PART B
        </h2>
        <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          Reserved for future integration.<br />
          This module will be connected later.
        </p>
        <div style={{ fontSize: '0.85rem', color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
          Isolated boundary interface: <code>src/features/partB/PartBPlaceholder.tsx</code>
        </div>
      </div>
    </div>
  );
};
