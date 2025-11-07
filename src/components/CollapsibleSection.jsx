
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import '../styles/CollapsibleSection.css';

function CollapsibleSection({ title, children, initialCollapsed = false }) {
    const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed);
    };

    return (
        <div className="collapsible-section">
            <button className="section-header" onClick={toggleCollapse}>
                <span className="section-title">{title}</span>
                {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
            </button>
            {!isCollapsed && (
                <div className="section-content">
                    {children}
                </div>
            )}
        </div>
    );
}

export default CollapsibleSection;
