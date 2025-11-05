// src/components/EditCardModal.jsx
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import '../styles/EditCardModal.css';

function EditCardModal({ card, isOpen, onClose, onSave, loading }) {
    const [editedTerm, setEditedTerm] = useState('');
    const [editedDefinition, setEditedDefinition] = useState('');

    useEffect(() => {
        if (card) {
            setEditedTerm(card.term);
            setEditedDefinition(card.definition);
        }
    }, [card]);

    if (!isOpen || !card) return null;

    const handleSave = () => {
        if (!editedTerm.trim() || !editedDefinition.trim()) {
            alert('Term and Definition cannot be empty.');
            return;
        }

        const editedCard = {
            ...card,
            term: editedTerm,
            definition: editedDefinition
        };
        onSave(editedCard);
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="modal-backdrop" onClick={handleBackdropClick}>
            <div className="modal-content edit-card-modal-content">
                <div className="modal-header">
                    <h3>Edit Flashcard</h3>
                    <button onClick={onClose} className="close-button"><X size={20} /></button>
                </div>
                <div className="modal-scroll-wrapper">
                    <div className="edit-card-form">
                        <div className="form-group">
                            <label>Term</label>
                            <textarea
                                value={editedTerm}
                                onChange={(e) => setEditedTerm(e.target.value)}
                                onInput={(e) => {
                                    e.target.style.height = 'auto';
                                    e.target.style.height = `${e.target.scrollHeight}px`;
                                }}
                                rows={1}
                            />
                        </div>
                        <div className="form-group">
                            <label>Definition</label>
                            <textarea
                                value={editedDefinition}
                                onChange={(e) => setEditedDefinition(e.target.value)}
                                onInput={(e) => {
                                    e.target.style.height = 'auto';
                                    e.target.style.height = `${e.target.scrollHeight}px`;
                                }}
                                rows={1}
                            />
                        </div>
                    </div>
                </div>
                <div className="modal-actions">
                    <button className="generate-button" onClick={handleSave} disabled={loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default EditCardModal;
