"use client"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Building2, ChevronDown, Plus, Megaphone, Sparkles } from "lucide-react"

interface Business {
  id: string
  name: string
  type: string
}

interface BusinessSelectorProps {
  businesses: Business[]
  currentBusinessId: string
  onSelectBusiness: (id: string) => void
  onAddBusiness: () => void
}

export function BusinessSelector({
  businesses,
  currentBusinessId,
  onSelectBusiness,
  onAddBusiness,
}: BusinessSelectorProps) {
  const currentBusiness = businesses.find((b) => b.id === currentBusinessId)

  const getBusinessIcon = (type: string) => {
    if (type === "gohighlevel-agency") return <Megaphone className="h-4 w-4" />
    if (type === "hair-stylist") return <Sparkles className="h-4 w-4" />
    return <Building2 className="h-4 w-4" />
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-[250px] justify-between bg-transparent">
          <div className="flex items-center gap-2">
            {currentBusiness && getBusinessIcon(currentBusiness.type)}
            <span className="truncate">{currentBusiness?.name || "Select Business"}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[250px]">
        {businesses.map((business) => (
          <DropdownMenuItem key={business.id} onClick={() => onSelectBusiness(business.id)}>
            <div className="flex items-center gap-2">
              {getBusinessIcon(business.type)}
              <span>{business.name}</span>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onClick={onAddBusiness} className="text-primary">
          <Plus className="h-4 w-4 mr-2" />
          Add New Business
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
