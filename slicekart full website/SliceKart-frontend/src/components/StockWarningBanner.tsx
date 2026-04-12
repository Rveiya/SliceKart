import { AlertTriangle, X, RefreshCw, Trash2 } from 'lucide-react';
import { StockIssue } from '../context/CartContext';

interface StockWarningBannerProps {
    issues: StockIssue[];
    onAdjustCart: () => void;
    onDismiss: () => void;
    isAdjusting: boolean;
}

export default function StockWarningBanner({
    issues,
    onAdjustCart,
    onDismiss,
    isAdjusting
}: StockWarningBannerProps) {
    if (issues.length === 0) return null;

    const outOfStockCount = issues.filter(i => i.type === 'out_of_stock').length;
    const insufficientCount = issues.filter(i => i.type === 'insufficient_stock').length;

    return (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-amber-800 text-sm">
                            Stock Availability Changed
                        </h4>
                        <button
                            onClick={onDismiss}
                            className="text-amber-500 hover:text-amber-700 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-xs text-amber-700 mt-1">
                        {outOfStockCount > 0 && `${outOfStockCount} item(s) are now out of stock. `}
                        {insufficientCount > 0 && `${insufficientCount} item(s) have limited availability.`}
                    </p>

                    {/* Issue Details */}
                    <div className="mt-3 space-y-2">
                        {issues.map((issue) => (
                            <div
                                key={issue.itemId}
                                className="flex items-center justify-between text-xs bg-white/50 rounded-lg px-3 py-2"
                            >
                                <div className="flex items-center gap-2">
                                    {issue.type === 'out_of_stock' ? (
                                        <Trash2 className="w-3 h-3 text-red-500" />
                                    ) : (
                                        <RefreshCw className="w-3 h-3 text-amber-500" />
                                    )}
                                    <span className="text-gray-700 font-medium truncate max-w-[150px]">
                                        {issue.productName}
                                    </span>
                                </div>
                                <span className={`font-medium ${issue.type === 'out_of_stock' ? 'text-red-600' : 'text-amber-600'}`}>
                                    {issue.type === 'out_of_stock'
                                        ? 'Out of stock'
                                        : `Only ${issue.availableStock} left`
                                    }
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={onAdjustCart}
                        disabled={isAdjusting}
                        className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-4 bg-amber-600 text-white font-medium text-xs rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isAdjusting ? (
                            <>
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                Adjusting...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="w-3 h-3" />
                                Update Cart to Available Stock
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

interface StockWarningItemBadgeProps {
    issue: StockIssue;
}

export function StockWarningItemBadge({ issue }: StockWarningItemBadgeProps) {
    return (
        <div className={`flex items-center gap-1 mt-1 text-xs ${issue.type === 'out_of_stock' ? 'text-red-600' : 'text-amber-600'}`}>
            <AlertTriangle className="w-3 h-3" />
            <span>
                {issue.type === 'out_of_stock'
                    ? 'Out of stock'
                    : `Only ${issue.availableStock} available`
                }
            </span>
        </div>
    );
}
