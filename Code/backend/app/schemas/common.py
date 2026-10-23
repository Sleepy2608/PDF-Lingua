from typing import Generic, TypeVar, Optional, Any
from pydantic import BaseModel, Field

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """Standardized response wrapper for all PDF-Lingua API endpoints."""
    success: bool = Field(default=True, description="Indicates if the request succeeded")
    message: str = Field(default="Success", description="User-friendly status message")
    data: Optional[T] = Field(default=None, description="Response payload")


class ErrorResponse(BaseModel):
    """Standardized error structure returned by Global Exception Handlers."""
    success: bool = Field(default=False, description="Always False for error responses")
    error_code: str = Field(..., description="Machine-readable error identifier")
    message: str = Field(..., description="Human-readable explanation of the error")
    details: Optional[Any] = Field(default=None, description="Detailed validation or debug info")
