import React from "react";
import { ImportExportTabProps } from "./types";
import { useImportExport } from "./useImportExport";
import { getAlertClass } from "./utils";

export const ImportExportTab: React.FC<ImportExportTabProps> = props => {
    const { message, isProcessing, fileInputRef, handleExport, handleClearAll, handleFileSelect, setMessage } =
        useImportExport(props);

    return (
        <div>
            {message && (
                <div className={`alert ${getAlertClass(message)} alert-dismissible fade show`} role="alert">
                    {message.text}
                    <button
                        type="button"
                        className="btn-close"
                        onClick={() => setMessage(null)}
                        aria-label="Close"
                    ></button>
                </div>
            )}

            <div className="card mb-4">
                <div className="card-header">
                    <h5 className="card-title mb-0">Export configuration</h5>
                </div>
                <div className="card-body">
                    <p className="text-muted">
                        Export all your configuration (assistants, exercises, and labs) to a JSON file. You can use this
                        file to make backups or transfer the configuration to another browser.
                    </p>
                    <button type="button" className="btn btn-primary" onClick={handleExport} disabled={isProcessing}>
                        {isProcessing ? (
                            <>
                                <span
                                    className="spinner-border spinner-border-sm me-2"
                                    role="status"
                                    aria-hidden="true"
                                />
                                {" Exporting..."}
                            </>
                        ) : (
                            <>
                                <i className="bi bi-download me-2" />
                                {" Export configuration"}
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="card mb-4">
                <div className="card-header">
                    <h5 className="card-title mb-0">Import configuration</h5>
                </div>
                <div className="card-body">
                    <p className="text-muted">
                        Import a configuration from a previously exported JSON file. This will overwrite existing data
                        with the file's data.
                    </p>
                    <div className="mb-3">
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="form-control"
                            accept=".json"
                            onChange={handleFileSelect}
                            disabled={isProcessing}
                        />
                    </div>
                    <div className="alert alert-warning" role="alert">
                        <strong>⚠️ Attention:</strong> Importing will overwrite existing data. It is recommended to
                        export first as a backup.
                    </div>
                </div>
            </div>

            <div className="card border-danger">
                <div className="card-header bg-danger text-white">
                    <h5 className="card-title mb-0">Danger zone</h5>
                </div>
                <div className="card-body">
                    <p className="text-muted">
                        Permanently delete all data stored by the extension. This action cannot be undone.
                    </p>
                    <button type="button" className="btn btn-danger" onClick={handleClearAll} disabled={isProcessing}>
                        {isProcessing ? (
                            <>
                                <span
                                    className="spinner-border spinner-border-sm me-2"
                                    role="status"
                                    aria-hidden="true"
                                />
                                {" Deleting..."}
                            </>
                        ) : (
                            <>
                                <i className="bi bi-trash me-2" />
                                {" Delete all data"}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportExportTab;
